import express from 'express';
import type { RequestHandler, Router } from 'express';
import type { AuditController } from '../controllers/audit.controller.js';

export function createAuditRouter(controller: AuditController, apiKey: RequestHandler): Router {
  const router = express.Router();
  router.post('/audit', apiKey, controller.handle);
  router.post('/process-media', apiKey, controller.processMedia);
  router.post('/batch-download', apiKey, controller.batchDownload);
  router.post('/discover-episodes', apiKey, controller.discoverEpisodesHandler);
  return router;
}