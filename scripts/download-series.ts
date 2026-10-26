import fs from 'node:fs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getApiKey(): string {
  try {
    const envContent = fs.readFileSync('.env', 'utf-8');
    const match = envContent.match(/^API_KEY=(.*)$/m);
    if (match) return match[1].trim();
  } catch {}
  return process.env.API_KEY || '';
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        options[key] = next;
        i++;
      } else {
        options[key] = 'true';
      }
    }
  }
  return options;
}

interface DiscoveredEpisode {
  url: string;
  slug: string;
  title: string | null;
  seasonNumber?: number;
  episodeNumber?: number;
}

// ---------------------------------------------------------------------------
// Descubrimiento de episodios via /api/discover-episodes
// ---------------------------------------------------------------------------

async function discoverEpisodes(
  seriesUrl: string,
  baseUrl: string,
  apiKey: string,
): Promise<DiscoveredEpisode[]> {
  console.log(`\n🔍 Descubriendo episodios de la serie: ${seriesUrl}...`);
  const res = await fetch(`${baseUrl}/api/discover-episodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({ seriesUrl, settleMs: 5000 }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`discover-episodes falló con HTTP ${res.status}: ${txt}`);
  }

  const data = (await res.json()) as { total: number; episodes: DiscoveredEpisode[] };
  console.log(`✅ ¡Se encontraron ${data.total} episodios en total!\n`);
  return data.episodes;
}

// ---------------------------------------------------------------------------
// Descarga individual via /api/audit (con steps automáticos de cookie + play)
// ---------------------------------------------------------------------------

async function downloadEpisode(
  episodeUrl: string,
  opts: { baseUrl: string; apiKey: string; sample?: number; overwrite?: boolean; format?: string },
): Promise<{ success: boolean; fileName?: string; alreadyExists?: boolean; error?: string }> {
  const res = await fetch(`${opts.baseUrl}/api/audit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': opts.apiKey },
    body: JSON.stringify({
      url: episodeUrl,
      settleMs: 9000,
      durationSecs: opts.sample,
      forceOverwrite: opts.overwrite ?? false,
      format: opts.format || 'mkv',
      steps: [
        {
          type: 'click',
          selector: "button:has-text('Aceptar todas'), button:has-text('Accept all'), button:has-text('Aceptar')",
          timeoutMs: 4000,
        },
        { type: 'play' },
      ],
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    return { success: false, error: `HTTP ${res.status}: ${txt}` };
  }

  const data = (await res.json()) as any;
  return data.mediaProcessing ?? { success: false, error: 'Sin respuesta de procesamiento multimedia' };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const options = parseArgs();
  const apiKey = options.apiKey || getApiKey();
  const baseUrl = options.host || 'http://localhost:3000';
  const sample = options.sample ? parseInt(options.sample, 10) : undefined;
  const overwrite = options.overwrite === 'true';
  const format = options.format === 'mp4' ? 'mp4' : 'mkv';
  const batchSize = parseInt(options['batch-size'] || options.batch || '5', 10);
  const seriesInput = options.series || options.url || 'https://canela.tv/tvseries/luna-roja';

  let episodesToProcess: DiscoveredEpisode[] = [];

  // ─── Modo A: Serie (auto-descubrimiento) ──────────────────────────────────
  if (seriesInput && !seriesInput.includes('{ep}')) {
    const allEpisodes = await discoverEpisodes(seriesInput, baseUrl, apiKey);
    if (allEpisodes.length === 0) {
      console.error('❌ No se encontraron episodios para la serie.');
      process.exit(1);
    }

    const startIdx = options.from ? Math.max(0, parseInt(options.from, 10) - 1) : 0;
    const endIdx = options.to ? Math.min(allEpisodes.length, parseInt(options.to, 10)) : allEpisodes.length;

    episodesToProcess = allEpisodes.slice(startIdx, endIdx);

  // ─── Modo B: Patrón manual con {ep} ──────────────────────────────────────
  } else if (seriesInput && seriesInput.includes('{ep}')) {
    const from = parseInt(options.from || '1', 10);
    const to = parseInt(options.to || '5', 10);
    for (let i = from; i <= to; i++) {
      const url = seriesInput.replace('{ep}', String(i));
      episodesToProcess.push({
        url,
        slug: `ep-${i}`,
        title: `Episodio ${i}`,
        episodeNumber: i,
      });
    }
  }

  const total = episodesToProcess.length;
  const totalBatches = Math.ceil(total / batchSize);

  console.log('================================================================');
  console.log('🚀 DESCARGA PROGRESIVA POR LOTES');
  console.log(`📡 Serie        : ${seriesInput}`);
  console.log(`🎬 Total eps    : ${total} episodios a procesar`);
  console.log(`📦 Tamaño lote  : ${batchSize} episodios por lote (${totalBatches} lotes en total)`);
  console.log(`🎞️  Formato      : ${format.toUpperCase()} (máxima resolución 1080p + mejor audio)`);
  console.log(`⏱️  Modo         : ${sample ? `Muestra de prueba de ${sample}s` : 'Episodio COMPLETO (calidad original)'}`);
  console.log(`📁 Carpeta local: src/application/storage/videos/`);
  console.log('================================================================\n');

  let totalDownloaded = 0;
  let totalExisted = 0;
  let totalFailed = 0;

  for (let b = 0; b < totalBatches; b++) {
    const batchStart = b * batchSize;
    const batchEnd = Math.min(batchStart + batchSize, total);
    const currentBatch = episodesToProcess.slice(batchStart, batchEnd);

    console.log(`\n📦 ==================== LOTE ${b + 1} de ${totalBatches} (Episodios ${batchStart + 1} al ${batchEnd}) ====================`);

    for (const [idxInBatch, ep] of currentBatch.entries()) {
      const globalIdx = batchStart + idxInBatch + 1;
      const progress = `[${globalIdx}/${total}]`;
      const epTitle = ep.title ? ` - "${ep.title}"` : '';

      console.log(`\n▶ ${progress} Episodio: ${ep.slug}${epTitle}`);
      console.log(`  🔗 ${ep.url}`);

      const result = await downloadEpisode(ep.url, { baseUrl, apiKey, sample, overwrite, format });

      if (result.success) {
        if (result.alreadyExists) {
          console.log(`  ⚡ Ya existía en tu PC (omitido): ${result.fileName}`);
          totalExisted++;
        } else {
          console.log(`  ✅ ¡Descargado correctamente!: ${result.fileName}`);
          totalDownloaded++;
        }
      } else {
        console.warn(`  ❌ Error: ${result.error || 'No se pudo capturar'}`);
        totalFailed++;
      }
    }

    console.log(`\n--- Resumen Lote ${b + 1}/${totalBatches}: Descargados: ${totalDownloaded} | Ya estaban: ${totalExisted} | Errores: ${totalFailed} ---`);

    // Pausa breve entre lotes de 5 para sincronizar disco y no saturar
    if (b < totalBatches - 1) {
      console.log('⏳ Pausando 3 segundos antes del siguiente lote...');
      await sleep(3000);
    }
  }

  console.log('\n================================================================');
  console.log('🎉 ¡TODOS LOS LOTES HAN SIDO COMPLETADOS!');
  console.log(`📊 Total procesados : ${total}`);
  console.log(`📥 Nuevos descargados: ${totalDownloaded}`);
  console.log(`⚡ Preexistentes     : ${totalExisted}`);
  console.log(`❌ Errores           : ${totalFailed}`);
  console.log('📁 Revisa tus videos en: src/application/storage/videos/');
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('\n❌ Error inesperado:', err instanceof Error ? err.message : err);
  process.exit(1);
});
