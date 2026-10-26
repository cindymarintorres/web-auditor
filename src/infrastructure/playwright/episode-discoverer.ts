import { chromium } from 'playwright';

export interface DiscoveredEpisode {
  url: string;
  slug: string;
  title: string | null;
  seasonNumber?: number;
  episodeNumber?: number;
}

/**
 * Consulta la API de CMS CDN de Canela.tv directamente.
 * Es mucho más rápida y precisa que scraping DOM en SPAs Angular.
 */
async function discoverCanelaEpisodes(seriesUrl: string): Promise<DiscoveredEpisode[] | null> {
  try {
    const parsed = new URL(seriesUrl);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const seriesSlug = segments[segments.length - 1];
    if (!seriesSlug) return null;

    // 1. Obtener ID de la serie
    const seriesMetaUrl = `https://data-store-cdn.cms.api.canela.tv/content/urn/resource/catalog/tvseries/${seriesSlug}?reg=us&acl=en&dt=web&ipr=true&client=canela-canela-web&pf=main`;
    const metaRes = await fetch(seriesMetaUrl, {
      headers: { 'Accept-Encoding': 'gzip, deflate, br' },
    });
    if (!metaRes.ok) return null;

    const metaData = (await metaRes.json()) as any;
    const seriesId = metaData?.data?.id;
    if (!seriesId) return null;

    // 2. Obtener temporadas
    const seasonsUrl = `https://data-store-cdn.cms.api.canela.tv/content/series/${seriesId}/seasons?pageNumber=1&pageSize=30&sortBy=snum&sortOrder=asc&reg=us&acl=en&dt=web&ipr=true&client=canela-canela-web&pf=main`;
    const seasonsRes = await fetch(seasonsUrl, {
      headers: { 'Accept-Encoding': 'gzip, deflate, br' },
    });
    if (!seasonsRes.ok) return null;

    const seasonsData = (await seasonsRes.json()) as any;
    const seasonsList: any[] = seasonsData?.data ?? [];
    if (!Array.isArray(seasonsList) || seasonsList.length === 0) return null;

    const allEpisodes: DiscoveredEpisode[] = [];

    // 3. Para cada temporada, obtener todos los episodios con paginación
    for (const season of seasonsList) {
      const seasonId = season.id;
      let page = 1;
      const pageSize = 100;
      let hasMore = true;

      while (hasMore) {
        const epUrl = `https://data-store-cdn.cms.api.canela.tv/content/series/${seriesId}/episodes?seasonId=${seasonId}&pageNumber=${page}&pageSize=${pageSize}&sortBy=epz&sortOrder=asc&reg=us&acl=en&dt=web&ipr=true&client=canela-canela-web&pf=main`;
        const epRes = await fetch(epUrl, {
          headers: { 'Accept-Encoding': 'gzip, deflate, br' },
        });
        if (!epRes.ok) break;

        const epData = (await epRes.json()) as any;
        const epsList: any[] = epData?.data ?? [];

        for (const ep of epsList) {
          const cnu = ep.cnu || ep.nu;
          if (!cnu) continue;

          // Extraer título en español si está disponible
          const titles = ep.lodn || ep.lon || [];
          const esTitle = titles.find((t: any) => t.lang?.startsWith('es'))?.n;
          const enTitle = titles.find((t: any) => t.lang?.startsWith('en'))?.n;
          const title = esTitle || enTitle || titles[0]?.n || null;

          allEpisodes.push({
            url: `https://canela.tv/player/tvepisode/${cnu}`,
            slug: cnu,
            title,
            seasonNumber: ep.snum,
            episodeNumber: ep.epnum,
          });
        }

        if (epsList.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      }
    }

    if (allEpisodes.length > 0) {
      return allEpisodes;
    }
  } catch (err) {
    console.warn('[Discover] Fallo al consultar API CMS de Canela, intentando Playwright:', err);
  }
  return null;
}

/**
 * Descubre los episodios de una serie.
 * Si es canela.tv, usa la API oficial de CDN (instantánea y completa).
 * Si no, usa Playwright con scroll e inspección del DOM.
 */
export async function discoverEpisodes(
  seriesUrl: string,
  opts: {
    settleMs?: number;
    scrollPasses?: number;
    navTimeoutMs?: number;
  } = {},
): Promise<DiscoveredEpisode[]> {
  // Estrategia 1: API directa si es canela.tv
  if (seriesUrl.includes('canela.tv')) {
    const fromApi = await discoverCanelaEpisodes(seriesUrl);
    if (fromApi && fromApi.length > 0) {
      return fromApi;
    }
  }

  // Estrategia 2: Playwright fallback
  const {
    settleMs = 5000,
    scrollPasses = 5,
    navTimeoutMs = 30_000,
  } = opts;

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-dev-shm-usage'],
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();

    await page.goto(seriesUrl, { waitUntil: 'domcontentloaded', timeout: navTimeoutMs });

    // Acepta cookies si aparece el banner
    try {
      const cookieBtn = page.locator(
        'button:has-text("Aceptar todas"), button:has-text("Accept all"), button:has-text("Aceptar"), [aria-label*="accept" i], [data-testid*="accept" i]',
      ).first();
      await cookieBtn.waitFor({ timeout: 4000, state: 'visible' });
      await cookieBtn.click();
      await page.waitForTimeout(800);
    } catch {
      // Sin banner
    }

    await page.waitForTimeout(settleMs);

    for (let i = 0; i < scrollPasses; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
      await page.waitForTimeout(1200);
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    const episodes = await page.evaluate((): Array<{ url: string; title: string | null }> => {
      const seen = new Set<string>();
      const results: Array<{ url: string; title: string | null }> = [];

      const anchors = document.querySelectorAll<HTMLAnchorElement>('a[href*="/player/tvepisode/"]');
      for (const a of Array.from(anchors)) {
        const href = a.href;
        if (!href || seen.has(href)) continue;
        seen.add(href);

        const title =
          a.getAttribute('title') ||
          a.getAttribute('aria-label') ||
          a.textContent?.trim() ||
          null;

        results.push({ url: href, title: title || null });
      }

      const dataHrefs = document.querySelectorAll<HTMLElement>('[data-href*="/player/tvepisode/"], [data-url*="/player/tvepisode/"]');
      for (const el of Array.from(dataHrefs)) {
        const href = el.getAttribute('data-href') || el.getAttribute('data-url') || '';
        if (!href || seen.has(href)) continue;
        seen.add(href);
        results.push({ url: href, title: el.getAttribute('title') || el.textContent?.trim() || null });
      }

      return results;
    });

    const baseOrigin = new URL(seriesUrl).origin;
    const mapped = episodes.map((ep) => {
      const absoluteUrl = ep.url.startsWith('http') ? ep.url : `${baseOrigin}${ep.url}`;
      const urlObj = new URL(absoluteUrl);
      const segments = urlObj.pathname.split('/').filter(Boolean);
      const slug = segments[segments.length - 1] || absoluteUrl;
      return {
        url: absoluteUrl,
        slug,
        title: ep.title,
      };
    });

    mapped.sort((a, b) => a.slug.localeCompare(b.slug, undefined, { numeric: true }));
    return mapped;
  } finally {
    await browser.close();
  }
}
