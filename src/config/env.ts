import path from 'node:path';

export interface Env {
  port: number;
  apiKey?: string;
  allowedHosts: string[];
  maxConcurrent: number;
  isProd: boolean;
  sessionsDir: string;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const allowedHosts = (source.ALLOWED_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);
  const isProd = source.NODE_ENV === 'production';

  // En producción exigimos allowlist (evita que el servicio sirva para SSRF)
  if (isProd && allowedHosts.length === 0) {
    throw new Error('Define ALLOWED_HOSTS en producción (hosts separados por coma).');
  }

  return {
    port: Number(source.PORT ?? 3000),
    apiKey: source.API_KEY || undefined,
    allowedHosts,
    maxConcurrent: Number(source.MAX_CONCURRENT ?? 2),
    isProd,
    sessionsDir: path.resolve(source.SESSIONS_DIR ?? 'sessions'),
  };
}