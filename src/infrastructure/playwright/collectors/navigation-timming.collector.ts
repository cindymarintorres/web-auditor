import type { Page } from 'playwright';
import type { NavigationTiming } from '../../../domain/types.js';

export class NavigationTimingCollector {
  collect(page: Page): Promise<NavigationTiming | null> {
    return page.evaluate((): NavigationTiming | null => {
      const n = performance.getEntriesByType('navigation')[0] as
        | PerformanceNavigationTiming
        | undefined;
      if (!n) return null;
      const paint: Record<string, number> = {};
      for (const p of performance.getEntriesByType('paint')) {
        paint[p.name] = Math.round(p.startTime);
      }
      return {
        ttfbMs: Math.round(n.responseStart),
        domContentLoadedMs: Math.round(n.domContentLoadedEventEnd),
        loadEventMs: Math.round(n.loadEventEnd),
        paint, // first-paint, first-contentful-paint
      };
    });
  }
}