import type { Locator, Page } from 'playwright';
import type { AuditStep } from '../../../domain/types.js';

/**
 * Si el paso trae "frame", busca dentro de ese iframe; si no, en la página.
 * "nth" elige cuál elemento si el selector coincide con varios.
 */
export function locateTarget(page: Page, step: AuditStep, defaultSelector?: string): Locator {
  const selector = step.selector ?? defaultSelector;
  if (!selector) throw new Error(`El paso "${step.type}" requiere "selector"`);

  const base = step.frame
    ? page.frameLocator(step.frame).locator(selector)
    : page.locator(selector);
  return base.nth(step.nth ?? 0);
}