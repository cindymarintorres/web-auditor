import { chromium, type Page } from 'playwright';
import type { AuditRunner } from '../../application/ports/audit-runner.port.js';
import type { SessionStore } from '../../application/ports/session-store.port.js';
import { redactStep } from '../../domain/redact-step.js';
import type {
  AuditRequest,
  AuditStep,
  RawAuditData,
  StepResult,
  StepType,
} from '../../domain/types.js';
import { sanitizeUrl } from '../../domain/url-sanitizer.js';
import { ConsoleCollector } from './collectors/console.collector.js';
import { NavigationTimingCollector } from './collectors/navigation-timming.collector.js';
import { NetworkCollector } from './collectors/network.collector.js';
import { VideoHealthCollector } from './collectors/video-health.collector.js';
import { createStepRegistry } from './steps/index.js';
import type { StepHandler } from './steps/step-handler.js';

// Solo orquesta: lanza el navegador, conecta colectores, ejecuta pasos y arma los datos crudos.
export class PlaywrightAuditRunner implements AuditRunner {
  constructor(
    private readonly sessions: SessionStore,
    private readonly stepRegistry: Map<StepType, StepHandler> = createStepRegistry(),
  ) {}

  async run(request: AuditRequest): Promise<RawAuditData> {
    const {
      url,
      steps = [],
      session,
      urlMode = 'strip',
      settleMs = 3000,
      navTimeoutMs = 30_000,
      stepTimeoutMs = 10_000,
    } = request;
    const clean = (u: string): string => sanitizeUrl(u, urlMode);

    const browser = await chromium.launch({
      headless: true,
      args: ['--autoplay-policy=no-user-gesture-required', '--disable-dev-shm-usage'],
    });

    try {
      // Solo cargamos sesión si la pidieron
      const storageState = session ? JSON.parse(await this.sessions.read(session)) : undefined;
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        storageState,
      });
      const page = await context.newPage();

      const network = new NetworkCollector(clean);
      const consoleLog = new ConsoleCollector();
      network.attach(page);
      consoleLog.attach(page);

      // 1) Carga inicial
      const t0 = Date.now();
      await page.goto(url, { waitUntil: 'load', timeout: navTimeoutMs });
      const loadMs = Date.now() - t0;

      // ¿Nos redirigió a otra parte? (típico: sesión expirada → login)
      const landedUrl = clean(page.url());
      const redirected = landedUrl !== clean(url);

      // 2) Interacciones
      const stepResults = await this.runSteps(page, steps, stepTimeoutMs);

      // 3) Dejamos terminar las peticiones en vuelo
      await page.waitForTimeout(Math.min(settleMs, 30_000));

      // 4) Snapshots finales
      const navigation = await new NavigationTimingCollector().collect(page);
      const videos = await new VideoHealthCollector(clean).collect(page);

      const networkData = network.result(); // Ahora retorna { records, manifests }
      
      return {
        url: clean(url),
        auditedAt: new Date().toISOString(),
        usedSession: Boolean(session),
        redirected,
        landedUrl,
        loadMs,
        navigation,
        steps: stepResults,
        requests: networkData.records,
        manifests: networkData.manifests, // <--- NUEVO: Lo pasamos al reporte crudo
        videos,
        ...consoleLog.result(),
      };
    } finally {
      await browser.close();
    }
  }

  private async runSteps(page: Page, steps: AuditStep[], defaultTimeout: number): Promise<StepResult[]> {
    const results: StepResult[] = [];
    for (const [index, step] of steps.entries()) {
      const started = Date.now();
      const base = { index, ...redactStep(step) };
      try {
        const handler = this.stepRegistry.get(step.type);
        if (!handler) throw new Error(`Paso desconocido: ${step.type}`);
        await handler.execute(step, { page, timeout: step.timeoutMs ?? defaultTimeout });
        results.push({ ...base, ok: true, durationMs: Date.now() - started });
      } catch (err) {
        results.push({
          ...base,
          ok: false,
          durationMs: Date.now() - started,
          error: (err as Error).message.split('\n')[0],
        });
      }
    }
    return results;
  }
}