import type { NextFunction, Request, Response } from "express";
import type { RunAuditUseCase } from "../../application/run-audit.usecase.js";
import type { AuditRequest } from "../../domain/types.js";
import { processMediaStreams } from "../../infrastructure/processor/media.processor.js";
import path from "path";

// Ruta de almacenamiento deseada: src/application/storage/videos
const outputDir = path.resolve("src/application/storage/videos");

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
      const report = await this.useCase.execute(request);

      // Opcional: Si quieres procesar automáticamente los manifiestos capturados
      // (Asumiendo que guardaste los manifiestos en el reporte o en el resultado crudo)

      if (report.media?.manifests?.length >= 2) {
        const videoUrl = report.media.manifests[0].url;
        const audioUrl = report.media.manifests[1].url;
        await processMediaStreams(videoUrl, audioUrl, outputDir);
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
      const { videoUrl, audioUrl } = req.body;

      if (!videoUrl || !audioUrl) {
        res.status(400).json({ error: "Faltan videoUrl o audioUrl" });
        return;
      }

      const result = await processMediaStreams(videoUrl, audioUrl, outputDir);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };
}
