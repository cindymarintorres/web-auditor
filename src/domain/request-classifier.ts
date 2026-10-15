import type { RequestCategory } from './types.js';

const MANIFEST_RE = /\.(m3u8|mpd)$/i;
const SEGMENT_RE = /\.(ts|m4s|aac|mp4)$/i;

export function classifyRequest(url: string, resourceType: string): RequestCategory {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return resourceType;
  }

  if (MANIFEST_RE.test(pathname)) return 'manifest';
  // Un .ts servido como script (Vite en dev, por ejemplo) NO es un segmento de video
  if (resourceType !== 'script' && SEGMENT_RE.test(pathname)) return 'media-segment';
  if (resourceType === 'fetch' || resourceType === 'xhr') return 'api';
  return resourceType; // document, stylesheet, image, font...
}