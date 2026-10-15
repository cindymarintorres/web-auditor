import type { AuditRequest, RawAuditData } from '../../domain/types.js';

export interface AuditRunner {
  run(request: AuditRequest): Promise<RawAuditData>;
}