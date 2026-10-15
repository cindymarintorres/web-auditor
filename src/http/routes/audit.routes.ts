import express from 'express';
import type { RequestHandler, Router } from 'express';
import type { AuditController } from '../controllers/audit.controller.js';

export function createAuditRouter(controller: AuditController, apiKey: RequestHandler): Router {
  const router = express.Router();
  router.post('/audit', apiKey, controller.handle);
  // NUEVA RUTA para procesar y fusionar los manifiestos multimedia mediante FFmpeg
  router.post('/process-media', apiKey, controller.processMedia);
  return router;
}