import type { NextFunction, Request, Response } from "express";
import type { RunAuditUseCase } from "../../application/run-audit.usecase.js";
import type { AuditRequest } from "../../domain/types.js";
import type { AuditReport } from "../../domain/report/build-report.js";
import { processMediaStreams } from "../../infrastructure/processor/media.processor.js";
import { discoverEpisodes } from "../../infrastructure/playwright/episode-discoverer.js";
import path from "path";

// Ruta de almacenamiento deseada: src/application/storage/videos
const outputDir = path.resolve("src/application/storage/videos");

export function extractEpisodeSlug(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    // Para URLs como https://canela.tv/player/tvepisode/luna-roja-el-accidente-de-ivan-s1-ep2
    const segments = parsed.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (last) {
      const sanitized = last
        .replace(/\.[a-zA-Z0-9]+$/, "")
        .replace(/[^a-zA-Z0-9_-]/g, "_");
      if (sanitized.length > 0) return sanitized;
    }
  } catch {}
  return `output_${Date.now()}`;
}

export class AuditController {
  constructor(
    private readonly useCase: RunAuditUseCase,
    private readonly validate: (body: unknown) => AuditRequest,
  ) {}

  // Arrow function para conservar "this" al pasarlo como handler de Express
  handle = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const request = this.validate(req.body);
      const report: AuditReport = await this.useCase.execute(request);

      // Si se detectaron manifiestos, intentamos procesar multimedia sin bloquear ni tumbar la auditoría
      if (report.media?.manifests && report.media.manifests.length > 0) {
        try {
          // 1. Buscamos y ordenamos para elegir la máxima resolución disponible (ej: 1920x1080)
          const videoManifests = report.media.manifests.filter((m: any) =>
            m.url.includes("default_video") ||
            (m.url.includes("video") && m.url.includes(".m3u8")),
          );
          videoManifests.sort((a: any, b: any) => {
            const score = (url: string) => {
              const res = url.match(/(\d+)x(\d+)/);
              if (res) return parseInt(res[1], 10) * parseInt(res[2], 10);
              const bit = url.match(/video(\d+)/i);
              return bit ? parseInt(bit[1], 10) : 0;
            };
            return score(b.url) - score(a.url);
          });
          const bestVideo = videoManifests[0]?.url;

          // 2. Buscamos y ordenamos para elegir el mejor audio (ej: audio192)
          const audioManifests = report.media.manifests.filter((m: any) =>
            m.url.includes("default_audio") ||
            (m.url.includes("audio") && m.url.includes(".m3u8")),
          );
          audioManifests.sort((a: any, b: any) => {
            const score = (url: string) => {
              const bit = url.match(/audio(\d+)/i);
              return bit ? parseInt(bit[1], 10) : 0;
            };
            return score(b.url) - score(a.url);
          });
          const bestAudio = audioManifests[0]?.url;

          // 3. Fallback a content.m3u8 si no hay streams separados
          const masterManifest =
            report.media.manifests.find((m: any) =>
              m.url.includes("content.m3u8"),
            ) || report.media.manifests[0];

          const targetVideoUrl = bestVideo || masterManifest.url;
          const targetAudioUrl = bestVideo && bestAudio ? bestAudio : undefined;

          // Nombre de archivo y formato (por defecto MKV para máxima compatibilidad y streaming sin pérdidas)
          const body = req.body as Record<string, unknown> | undefined;
          const format = body?.format === "mp4" ? "mp4" : "mkv";
          const rawName =
            (typeof body?.outputFileName === "string" && body.outputFileName) ||
            (typeof body?.fileName === "string" && body.fileName) ||
            extractEpisodeSlug(report.url);
          const chosenName = rawName.includes(".") ? rawName : `${rawName}.${format}`;

          // Si el usuario especifica durationSecs > 0 (ej: 15), se usa ese muestreo.
          // Si no se especifica o es 0, se descarga el episodio COMPLETO sin cortes.
          const duration =
            typeof body?.durationSecs === "number" && body.durationSecs > 0
              ? body.durationSecs
              : undefined;

          const forceOverwrite = Boolean(
            body?.forceOverwrite ?? body?.overwrite,
          );

          if (targetVideoUrl) {
            const mediaResult = await processMediaStreams(
              targetVideoUrl,
              targetAudioUrl,
              outputDir,
              undefined,
              duration,
              chosenName,
              forceOverwrite,
            );
            report.mediaProcessing = mediaResult;
          } else {
            report.mediaProcessing = {
              success: false,
              error:
                "No se encontró un stream de video compatible para procesar.",
            };
          }
        } catch (mediaErr: unknown) {
          const message =
            mediaErr instanceof Error ? mediaErr.message : String(mediaErr);
          console.warn(
            "Aviso: No se pudo procesar automáticamente el stream multimedia:",
            message,
          );
          report.mediaProcessing = {
            success: false,
            error: message,
          };
        }
      }

      res.json(report);
    } catch (err) {
      next(err); // el error-handler decide el código HTTP
    }
  };

  processMedia = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const {
        videoUrl,
        audioUrl,
        fileName,
        outputFileName,
        durationSecs,
        forceOverwrite,
        overwrite,
      } = req.body;

      if (!videoUrl) {
        res.status(400).json({ error: "Falta videoUrl" });
        return;
      }

      const chosenName = outputFileName || fileName;
      const duration =
        typeof durationSecs === "number" && durationSecs > 0
          ? durationSecs
          : undefined;

      const result = await processMediaStreams(
        videoUrl,
        audioUrl,
        outputDir,
        undefined,
        duration,
        chosenName,
        Boolean(forceOverwrite ?? overwrite),
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  batchDownload = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const {
        urlPattern,   // ej: "https://canela.tv/player/tvepisode/luna-roja-el-accidente-de-ivan-s1-ep{ep}"
        episodeUrls,  // alternativa: array de URLs ya descubiertas por /discover-episodes
        from = 1,
        to = 1,
        settleMs = 10000,
        durationSecs,
        forceOverwrite = false,
      } = req.body;

      // Construimos la lista de URLs a procesar
      let urlList: string[] = [];

      if (Array.isArray(episodeUrls) && episodeUrls.length > 0) {
        // Modo: lista directa de URLs (descubiertas)
        urlList = episodeUrls;
      } else if (urlPattern && typeof urlPattern === "string" && urlPattern.includes("{ep}")) {
        // Modo: patrón con {ep}
        for (let ep = Number(from); ep <= Number(to); ep++) {
          urlList.push(urlPattern.replace("{ep}", String(ep)));
        }
      } else {
        res.status(400).json({
          error:
            'Debes incluir "episodeUrls" (array de URLs) o "urlPattern" con el marcador "{ep}".',
        });
        return;
      }

      const results = [];
      const duration =
        typeof durationSecs === "number" && durationSecs > 0
          ? durationSecs
          : undefined;

      // Steps inyectados automáticamente en cada episodio:
      //  1. Aceptar banner de cookies (falla silenciosamente si no aparece)
      //  2. Dar play al video para que el player dispare los manifiestos HLS
      const autoSteps = [
        {
          type: "click" as const,
          selector:
            "button:has-text('Aceptar todas'), button:has-text('Accept all'), button:has-text('Aceptar')",
          timeoutMs: 4000,
        },
        { type: "play" as const },
      ];

      for (const [index, episodeUrl] of urlList.entries()) {
        const epLabel = index + 1;
        console.log(
          `[Batch] [${epLabel}/${urlList.length}] Procesando: ${episodeUrl}`,
        );

        try {
          const auditReq = this.validate({
            url: episodeUrl,
            settleMs,
            steps: autoSteps,
          });
          const report = await this.useCase.execute(auditReq);

          const videoManifests = (report.media?.manifests || []).filter((m: any) =>
            m.url.includes("default_video") ||
            (m.url.includes("video") && m.url.includes(".m3u8")),
          );
          videoManifests.sort((a: any, b: any) => {
            const score = (url: string) => {
              const res = url.match(/(\d+)x(\d+)/);
              if (res) return parseInt(res[1], 10) * parseInt(res[2], 10);
              const bit = url.match(/video(\d+)/i);
              return bit ? parseInt(bit[1], 10) : 0;
            };
            return score(b.url) - score(a.url);
          });
          const bestVideo = videoManifests[0]?.url;

          const audioManifests = (report.media?.manifests || []).filter((m: any) =>
            m.url.includes("default_audio") ||
            (m.url.includes("audio") && m.url.includes(".m3u8")),
          );
          audioManifests.sort((a: any, b: any) => {
            const score = (url: string) => {
              const bit = url.match(/audio(\d+)/i);
              return bit ? parseInt(bit[1], 10) : 0;
            };
            return score(b.url) - score(a.url);
          });
          const bestAudio = audioManifests[0]?.url;

          const masterManifest =
            report.media?.manifests?.find((m: any) =>
              m.url.includes("content.m3u8"),
            ) || report.media?.manifests?.[0];

          const targetVideoUrl = bestVideo || masterManifest?.url;
          const targetAudioUrl = bestVideo && bestAudio ? bestAudio : undefined;

          if (targetVideoUrl) {
            const format = req.body?.format === "mp4" ? "mp4" : "mkv";
            const fileName = `${extractEpisodeSlug(episodeUrl)}.${format}`;
            const mediaResult = await processMediaStreams(
              targetVideoUrl,
              targetAudioUrl,
              outputDir,
              undefined,
              duration,
              fileName,
              Boolean(forceOverwrite),
            );
            results.push({
              episode: epLabel,
              url: episodeUrl,
              ...mediaResult,
            });
          } else {
            results.push({
              episode: epLabel,
              url: episodeUrl,
              success: false,
              error: "No se detectaron manifiestos de video en la página.",
            });
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          results.push({
            episode: epLabel,
            url: episodeUrl,
            success: false,
            error: message,
          });
        }
      }

      res.json({
        total: results.length,
        results,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/discover-episodes
   * Body: { seriesUrl: string, settleMs?: number, scrollPasses?: number }
   * Abre la página de la serie con Playwright, acepta cookies, hace scroll
   * para cargar lazy-load, y extrae todas las URLs de episodios encontradas.
   */
  discoverEpisodesHandler = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const {
        seriesUrl,
        settleMs = 5000,
        scrollPasses = 6,
      } = req.body;

      if (!seriesUrl || typeof seriesUrl !== "string") {
        res.status(400).json({ error: 'Falta "seriesUrl" en el body.' });
        return;
      }

      console.log(`[Discover] Buscando episodios en: ${seriesUrl}`);
      const episodes = await discoverEpisodes(seriesUrl, {
        settleMs,
        scrollPasses,
      });

      console.log(`[Discover] Encontrados ${episodes.length} episodios.`);
      res.json({
        seriesUrl,
        total: episodes.length,
        episodes,
      });
    } catch (err) {
      next(err);
    }
  };
}
