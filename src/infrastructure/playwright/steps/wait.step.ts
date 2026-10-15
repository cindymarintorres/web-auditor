import type { StepHandler } from './step-handler.js';

export const waitStep: StepHandler = {
  type: 'wait',
  async execute(step, { page }) {
    await page.waitForTimeout(Math.min(step.ms ?? 1000, 30_000));
  },
};