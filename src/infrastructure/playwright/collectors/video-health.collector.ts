import type { Page } from 'playwright';
import type { VideoHealth } from '../../../domain/types.js';

// Colector de "snapshot": collect(page) al final.
// Revisa <video> en la página principal y en iframes (los players suelen vivir en iframes).
export class VideoHealthCollector {
  constructor(private readonly clean: (url: string) => string) {}

  async collect(page: Page): Promise<VideoHealth[]> {
    const results: VideoHealth[] = [];
    for (const frame of page.frames()) {
      try {
        const videos = await frame.evaluate((): Omit<VideoHealth, 'frame'>[] =>
          Array.from(document.querySelectorAll('video')).map((v) => ({
            readyState: v.readyState,
            networkState: v.networkState,
            paused: v.paused,
            currentTime: Number(v.currentTime.toFixed(2)),
            duration: Number.isFinite(v.duration) ? Number(v.duration.toFixed(2)) : null,
            width: v.videoWidth,
            height: v.videoHeight,
            playing: !v.paused && v.readyState > 2 && v.currentTime > 0,
            error: v.error ? { code: v.error.code, message: v.error.message } : null,
          })),
        );
        for (const v of videos) results.push({ frame: this.clean(frame.url()), ...v });
      } catch {
        /* frame destruido o inaccesible: lo ignoramos */
      }
    }
    return results;
  }
}