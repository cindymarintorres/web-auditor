import type { StepType } from '../../../domain/types.js';
import { clickStep } from './click.step.js';
import { fillStep } from './fill.step.js';
import { gotoStep } from './goto.step.js';
import { playStep } from './play.step.js';
import type { StepHandler } from './step-handler.js';
import { waitForSelectorStep } from './wait-for-selector.step.js';
import { waitStep } from './wait.step.js';

const builtIn: StepHandler[] = [
  clickStep,
  fillStep,
  waitForSelectorStep,
  waitStep,
  gotoStep,
  playStep,
];

// Agregar un paso nuevo = crear su archivo y sumarlo aquí (el runner no se toca).
export function createStepRegistry(extra: StepHandler[] = []): Map<StepType, StepHandler> {
  return new Map([...builtIn, ...extra].map((h) => [h.type, h] as const));
}