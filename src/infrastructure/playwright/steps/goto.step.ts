import type { StepHandler } from './step-handler.js';

export const gotoStep: StepHandler = {
  type: 'goto',
  async execute(step, { page, timeout }) {
    if (!step.url) throw new Error('El paso "goto" requiere "url"');
    await page.goto(step.url, { waitUntil: 'domcontentloaded', timeout });
  },
};