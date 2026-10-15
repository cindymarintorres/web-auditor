import type { UrlMode } from './types.js';

/**
 * "strip": quita todo el query string.
 * "keys":  deja los nombres de los parámetros con valor ***  (?bc_token=***)
 */
export function sanitizeUrl(raw: string, mode: UrlMode = 'strip'): string {
  try {
    const u = new URL(raw);
    const base = `${u.origin}${u.pathname}`;
    if (mode === 'keys' && u.search) {
      const keys = [...new Set(u.searchParams.keys())];
      return `${base}?${keys.map((k) => `${k}=***`).join('&')}`;
    }
    return base;
  } catch {
    return raw;
  }
}