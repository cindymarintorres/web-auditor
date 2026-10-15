import type { NetworkRecord } from '../types.js';

export interface NetworkSummary {
  totalRequests: number;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  latencyMs: { p50: number | null; p95: number | null; max: number | null };
  slowest: Array<Pick<NetworkRecord, 'url' | 'category' | 'status' | 'durationMs'>>;
  errors: Array<Pick<NetworkRecord, 'url' | 'category' | 'status' | 'failure'>>;
}

// "Falló de red" (failed) o "respondió con error" (status >= 400)
export const isBadRequest = (r: NetworkRecord): boolean => r.failed || (r.status ?? 0) >= 400;

const statusClass = (r: NetworkRecord): string =>
  r.failed ? 'failed' : `${Math.floor((r.status ?? 0) / 100)}xx`;

const percentile = (sorted: number[], p: number): number | null =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : null;

export function summarizeNetwork(requests: NetworkRecord[]): NetworkSummary {
  const byCategory: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const r of requests) {
    byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
    const sc = statusClass(r);
    byStatus[sc] = (byStatus[sc] ?? 0) + 1;
  }

  const durations = requests.map((r) => r.durationMs).sort((a, b) => a - b);

  return {
    totalRequests: requests.length,
    byCategory,
    byStatus,
    latencyMs: {
      p50: percentile(durations, 0.5),
      p95: percentile(durations, 0.95),
      max: durations.at(-1) ?? null,
    },
    slowest: [...requests]
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, 5)
      .map(({ url, category, status, durationMs }) => ({ url, category, status, durationMs })),
    errors: requests
      .filter(isBadRequest)
      .map(({ url, category, status, failure }) => ({ url, category, status, failure })),
  };
}