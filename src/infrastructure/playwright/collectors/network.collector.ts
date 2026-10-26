import type { Page, Request } from "playwright";
import { classifyRequest } from "../../../domain/request-classifier.js";
import type { NetworkRecord } from "../../../domain/types.js";

const round = (n: number): number => Math.round(n * 10) / 10;

// Colector de "listeners": attach(page) al inicio, result() al final.
export class NetworkCollector {
  private readonly startedAt = new Map<Request, number>();
  private readonly records: NetworkRecord[] = [];
  private readonly manifests: string[] = []; // Almacena URLs completas de manifiestos

  constructor(private readonly clean: (url: string) => string) {}

  attach(page: Page): void {
    page.on("request", (req) => {
      this.startedAt.set(req, Date.now());
    });

    // Terminó con respuesta (incluye 4xx/5xx: para Playwright eso sigue siendo "finished")
    page.on("requestfinished", async (req) => {
      const res = await req.response().catch(() => null);
      const { responseStart } = req.timing();

      const rawUrl = req.url();
      const category = classifyRequest(rawUrl, req.resourceType());

      if (category === "manifest") {
        const isThumbnailOrPreview =
          rawUrl.includes("preview") ||
          rawUrl.includes("thumb") ||
          rawUrl.includes("small");

        if (!isThumbnailOrPreview && !this.manifests.includes(rawUrl)) {
          // Prioridad al manifiesto maestro "content.m3u8"
          if (rawUrl.includes("content.m3u8")) {
            this.manifests.unshift(rawUrl);
          } else {
            this.manifests.push(rawUrl);
          }
        }
      }

      this.records.push({
        ...this.base(req, category, rawUrl),
        status: res?.status() ?? null,
        ttfbMs: responseStart >= 0 ? round(responseStart) : null,
        failed: false,
      });
    });

    // Falló de red (DNS, conexión cortada, bloqueada, etc.)
    page.on("requestfailed", (req) => {
      const rawUrl = req.url();
      const category = classifyRequest(rawUrl, req.resourceType());

      this.records.push({
        ...this.base(req, category, rawUrl),
        status: null,
        ttfbMs: null,
        failed: true,
        failure: req.failure()?.errorText,
      });
    });
  }

  result() {
    return {
      records: this.records,
      manifests: this.manifests,
    };
  }

  private base(req: Request, category?: string, rawUrl?: string) {
    const url = rawUrl ?? req.url();
    const cat = category ?? classifyRequest(url, req.resourceType());
    // Para los manifiestos preservamos la URL completa (incluyendo tokens como ?bc_token=...)
    // para que la autenticación sea válida al inspeccionarlos o procesarlos.
    const finalUrl = cat === "manifest" ? url : this.clean(url);

    return {
      url: finalUrl,
      method: req.method(),
      category: cat,
      durationMs: Date.now() - (this.startedAt.get(req) ?? Date.now()),
    };
  }
}
