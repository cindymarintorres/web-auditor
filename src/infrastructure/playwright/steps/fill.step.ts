import { locateTarget } from './locate.js';
import type { StepHandler } from './step-handler.js';

export const fillStep: StepHandler = {
  type: 'fill',
  async execute(step, { page, timeout }) {
    await locateTarget(page, step).fill(step.value ?? '', { timeout });
  },
};