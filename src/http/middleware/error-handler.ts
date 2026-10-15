import type { ErrorRequestHandler } from 'express';
import { TooManyAuditsError } from '../../application/errors.js';
import { ValidationError } from '../validators/audit-request.validator.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ValidationError) {
    res.status(400).json({ error: err.message });
    return;
  }
  if (err instanceof TooManyAuditsError) {
    res.status(429).json({ error: err.message });
    return;
  }
  // Errores del parser de Express (JSON mal formado, body muy grande...)
  const status = (err as { status?: number } | null)?.status;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    res.status(status).json({ error: 'Solicitud inválida' });
    return;
  }

  console.error(err);
  res.status(500).json({
    error: 'La auditoría falló',
    detail: err instanceof Error ? err.message : String(err),
  });
};