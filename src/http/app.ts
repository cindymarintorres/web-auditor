import express from 'express';
import type { Express, Router } from 'express';
import { errorHandler } from './middleware/error-handler.js';

export interface AppDeps {
  auditRouter: Router;
}

export function createApp({ auditRouter }: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use('/api', auditRouter); // → POST /api/audit

  app.use(errorHandler);
  return app;
}