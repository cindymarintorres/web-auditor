import type { Page } from 'playwright';
import type { AuditStep, StepType } from '../../../domain/types.js';

export interface StepContext {
  page: Page;
  timeout: number;
}

export interface StepHandler {
  readonly type: StepType;
  execute(step: AuditStep, ctx: StepContext): Promise<void>;
}