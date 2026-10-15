import { locateTarget } from './locate.js';
import type { StepHandler } from './step-handler.js';

// Intenta reproducir un <video> (por defecto el primero; dentro del frame si se indicó).
// Si el navegador bloquea el autoplay, el paso falla con ese error: también es información.
export const playStep: StepHandler = {
  type: 'play',
  async execute(step, { page, timeout }) {
    await locateTarget(page, step, 'video').evaluate(
      (el) => (el as HTMLVideoElement).play(),
      undefined,
      { timeout },
    );
  },
};