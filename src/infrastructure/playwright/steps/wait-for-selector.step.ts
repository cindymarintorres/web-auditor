import { locateTarget } from './locate.js';
import type { StepHandler } from './step-handler.js';

export const waitForSelectorStep: StepHandler = {
  type: 'waitForSelector',
  async execute(step, { page, timeout }) {
    await locateTarget(page, step).waitFor({ state: 'visible', timeout });
  },
};