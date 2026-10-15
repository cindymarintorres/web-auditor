import type { AuditStep, RedactedStep } from './types.js';

// Lo escrito en un "fill" puede ser una contraseña: nunca sale en el reporte.
export function redactStep(step: AuditStep): RedactedStep {
  const { value, ...rest } = step;
  return value === undefined ? rest : { ...rest, value: '***' as const };
}