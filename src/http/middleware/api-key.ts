import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// Si no hay API_KEY configurada, deja pasar (útil en local).
export function apiKeyGuard(apiKey: string | undefined): RequestHandler {
  return (req, res, next) => {
    if (apiKey && !safeEqual(req.get('x-api-key') ?? '', apiKey)) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }
    next();
  };
}