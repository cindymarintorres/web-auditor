import type { RawAuditData, Verdict } from '../types.js';
import { isBadRequest } from './network-summary.js';

export interface Evaluation {
  verdict: Verdict;
  warnings: string[];
}

const MEDIA_CATEGORIES = ['manifest', 'media-segment'];

export function evaluate(raw: RawAuditData): Evaluation {
  const { requests, videos, steps } = raw;
  const manifests = requests.filter((r) => r.category === 'manifest');
  const segments = requests.filter((r) => r.category === 'media-segment');
  const mediaDetected = videos.length > 0 || manifests.length > 0;

  // Warnings explicables: cada uno depende de una condición concreta
  const warnings: string[] = [];
  if (raw.redirected) {
    warnings.push(
      `La página redirigió a ${raw.landedUrl}` +
        (raw.usedSession ? ' (la sesión guardada podría haber expirado)' : ''),
    );
  }
  // Solo avisamos de "sin multimedia" si el usuario pidió reproducir algo
  if (!mediaDetected && steps.some((s) => s.type === 'play')) {
    warnings.push('Pediste reproducir un video pero no se detectó ningún <video> ni manifiesto');
  }

  const hasMediaFailure =
    manifests.some(isBadRequest) ||
    segments.some(isBadRequest) ||
    videos.some((v) => v.error !== null) ||
    // hay <video> pero no se pidió ni un manifiesto ni un segmento
    (videos.length > 0 && manifests.length === 0 && segments.length === 0);

  if (hasMediaFailure) return { verdict: 'fail', warnings };

  const hasWarning =
    requests.some((r) => isBadRequest(r) && !MEDIA_CATEGORIES.includes(r.category)) ||
    steps.some((s) => !s.ok) ||
    raw.consoleErrors.length > 0 ||
    raw.pageErrors.length > 0 ||
    warnings.length > 0;

  return { verdict: hasWarning ? 'warn' : 'pass', warnings };
}