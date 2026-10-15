import { locateTarget } from './locate.js';
import type { StepHandler } from './step-handler.js';

export const clickStep: StepHandler = {
  type: 'click',
  async execute(step, { page, timeout }) {
    await locateTarget(page, step).click({ timeout });
  },
};