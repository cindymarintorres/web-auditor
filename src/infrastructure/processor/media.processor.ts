import { execFile } from "child_process";
import path from "path";
import fs from "fs";

export interface MediaProcessResult {
  success: boolean;
  file?: string;
  fileName?: string;
  error?: string;
  alreadyExists?: boolean;
}

export function processMediaStreams(
  videoUrl: string,
  audioUrl?: string,
  customOutputDir?: string,
  customHeaders?: string,
  durationSecs?: number,
  customFileName?: string,
  forceOverwrite?: boolean,
): Promise<{
  success: boolean;
  file: string;
  fileName: string;
  alreadyExists?: boolean;
}> {
  return new Promise((resolve, reject) => {
    if (!videoUrl) {
      return reject(new Error("Falta la URL del stream multimedia."));
    }

    const outputDir =
      customOutputDir || path.resolve("src/application/storage/videos");

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Detectar extensión deseada (mkv o mp4)
    const extMatch = customFileName?.match(/\.(mp4|mkv)$/i);
    const targetExt = extMatch ? extMatch[1].toLowerCase() : (customFileName?.endsWith('.mp4') ? 'mp4' : 'mkv');
    const baseName = customFileName
      ? customFileName.replace(/\.(mp4|mkv)$/i, "")
      : `output_${Date.now()}`;
    const outputFileName = `${baseName}.${targetExt}`;
    const outputPath = path.join(outputDir, outputFileName);

    // Si ya existe el video completo (un episodio real de 45m pesa >100MB; usamos >50MB para no confundir con muestras de prueba)
    if (!forceOverwrite) {
      for (const ext of ['mkv', 'mp4']) {
        const checkPath = path.join(outputDir, `${baseName}.${ext}`);
        if (fs.existsSync(checkPath)) {
          const stats = fs.statSync(checkPath);
          if (stats.size > 50 * 1024 * 1024) {
            console.log(
              `El video "${baseName}.${ext}" ya existe en disco (${(stats.size / 1024 / 1024).toFixed(1)} MB). Omitiendo descarga repetida.`,
            );
            return resolve({
              success: true,
              file: checkPath,
              fileName: `${baseName}.${ext}`,
              alreadyExists: true,
            });
          }
        }
      }
    }

    const isSingle = !audioUrl || audioUrl === videoUrl;

    const headers =
      customHeaders ||
      "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36\r\nReferer: https://canela.tv/\r\nOrigin: https://canela.tv\r\n";

    const args: string[] = [
      "-headers",
      headers,
      "-i",
      videoUrl,
    ];

    if (!isSingle && audioUrl) {
      args.push("-headers", headers, "-i", audioUrl);
    }

    // Solo limitamos si durationSecs es mayor a 0 (ej: 15s para test). Si no, descarga el episodio COMPLETO.
    if (durationSecs && durationSecs > 0) {
      args.push("-t", String(durationSecs));
    }

    if (targetExt === 'mkv') {
      args.push("-c", "copy", outputPath, "-y");
    } else {
      args.push("-c", "copy", "-bsf:a", "aac_adtstoasc", outputPath, "-y");
    }

    console.log("Iniciando fusión/descarga de stream multimedia con FFmpeg:", args.join(" "));

    // 30 minutos de timeout para episodios completos de series
    const timeoutMs =
      durationSecs && durationSecs > 0
        ? (durationSecs + 45) * 1000
        : 30 * 60 * 1000;

    execFile("ffmpeg", args, { timeout: timeoutMs }, (error) => {
      if (error) {
        console.error(`Error en FFmpeg: ${error.message}`);
        return reject(
          new Error(
            `Fallo al procesar el contenido multimedia: ${error.message}`,
          ),
        );
      }

      console.log(`¡Video "${outputFileName}" generado con éxito!`);
      resolve({
        success: true,
        file: outputPath,
        fileName: outputFileName,
      });
    });
  });
}