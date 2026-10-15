import { buildReport, type AuditReport } from '../domain/report/build-report.js';
import type { AuditRequest } from '../domain/types.js';
import type { ConcurrencyLimiter } from './concurrency-limiter.js';
import type { AuditRunner } from './ports/audit-runner.port.js';

export class RunAuditUseCase {
  constructor(
    private readonly runner: AuditRunner,
    private readonly limiter: ConcurrencyLimiter,
  ) {}

  async execute(request: AuditRequest): Promise<AuditReport> {
    const raw = await this.limiter.run(() => this.runner.run(request));
    return buildReport(raw);
  }
}