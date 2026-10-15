import { exec } from "child_process";
import path from "path";
import fs from "fs";

export function processMediaStreams(videoUrl: string, audioUrl: string, customOutputDir?:string): Promise<{ success: boolean; file: string; fileName: string }> {
  return new Promise((resolve, reject) => {
    if (!videoUrl || !audioUrl) {
      return reject(
        new Error("Faltan las URLs de los manifiestos (video y audio)."),
      );
    }

    // Definimos la ruta exacta solicitada
    const outputDir = customOutputDir || path.resolve("src/application/storage/videos");

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputFileName = `output_${Date.now()}.mp4`;
    const outputPath = path.join(outputDir, outputFileName);

    const ffmpegCommand = `ffmpeg -i "${videoUrl}" -i "${audioUrl}" -c copy "${outputPath}"`;

    console.log("Iniciando fusión de streams multimedia con FFmpeg...");

    exec(ffmpegCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error en FFmpeg: ${error.message}`);
        return reject(
          new Error(
            `Fallo al procesar el contenido multimedia: ${error.message}`,
          ),
        );
      }

      console.log("¡Video fusionado con éxito!");
      resolve({
        success: true,
        file: outputPath,
        fileName: outputFileName,
      });
    });
  });
}