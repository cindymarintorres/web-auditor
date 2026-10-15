import type { NetworkRecord, VideoHealth } from '../types.js';
import { isBadRequest } from './network-summary.js';

export interface MediaSummary {
  detected: boolean;
  manifests: Array<{
    url: string;
    status: number | null;
    ttfbMs: number | null;
    durationMs: number;
    ok: boolean;
  }>;
  segments: { total: number; failed: number };
  videos: VideoHealth[];
}

export function summarizeMedia(requests: NetworkRecord[], videos: VideoHealth[]): MediaSummary {
  const manifests = requests.filter((r) => r.category === 'manifest');
  const segments = requests.filter((r) => r.category === 'media-segment');

  return {
    detected: videos.length > 0 || manifests.length > 0,
    manifests: manifests.map(({ url, status, ttfbMs, durationMs, failed }) => ({
      url,
      status,
      ttfbMs,
      durationMs,
      ok: !failed && status !== null && status >= 200 && status < 300,
    })),
    segments: { total: segments.length, failed: segments.filter(isBadRequest).length },
    videos,
  };
}