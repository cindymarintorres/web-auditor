import type { Page, Request } from "playwright";
import { classifyRequest } from "../../../domain/request-classifier.js";
import type { NetworkRecord } from "../../../domain/types.js";

const round = (n: number): number => Math.round(n * 10) / 10;

// Colector de "listeners": attach(page) al inicio, result() al final.
export class NetworkCollector {
  private readonly startedAt = new Map<Request, number>();
  private readonly records: NetworkRecord[] = [];
  private readonly manifests: string[] = []; // <---Almacena URLs de manifiestos

  constructor(private readonly clean: (url: string) => string) {}

  attach(page: Page): void {
    page.on("request", (req) => {
      this.startedAt.set(req, Date.now());
    });

    // Terminó con respuesta (incluye 4xx/5xx: para Playwright eso sigue siendo "finished")
    page.on("requestfinished", async (req) => {
      const res = await req.response().catch(() => null);
      const { responseStart } = req.timing();

      const url = req.url();
      const category = classifyRequest(url, req.resourceType());

      // <---Si la categoría es manifiesto, lo guardamos limpio
      if (category === "manifest") {
        const cleanedUrl = this.clean(url);
        if (!this.manifests.includes(cleanedUrl)) {
          this.manifests.push(cleanedUrl);
        }
      }

      this.records.push({
        ...this.base(req),
        status: res?.status() ?? null,
        ttfbMs: responseStart >= 0 ? round(responseStart) : null,
        failed: false,
      });
    });

    // Falló de red (DNS, conexión cortada, bloqueada, etc.)
    page.on("requestfailed", (req) => {
      this.records.push({
        ...this.base(req),
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
      manifests: this.manifests, //Retornamos los manifiestos detectados
    };
  }

  private base(req: Request) {
    return {
      url: this.clean(req.url()),
      method: req.method(),
      category: classifyRequest(req.url(), req.resourceType()),
      durationMs: Date.now() - (this.startedAt.get(req) ?? Date.now()),
    };
  }
}
