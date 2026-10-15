import { loadEnv, type Env } from './config/env.js';
import { FileSessionStore } from './infrastructure/sessions/file-session-store.js';
import { PlaywrightAuditRunner } from './infrastructure/playwright/playwright-audit-runner.js';
import { ConcurrencyLimiter } from './application/concurrency-limiter.js';
import { RunAuditUseCase } from './application/run-audit.usecase.js';
import { createAuditRequestValidator } from './http/validators/audit-request.validator.js';
import { AuditController } from './http/controllers/audit.controller.js';
import { createAuditRouter } from './http/routes/audit.routes.js';
import { apiKeyGuard } from './http/middleware/api-key.js';
import { createApp } from './http/app.js';

// Composition root: el ÚNICO lugar donde se crean y conectan las dependencias.
function bootstrap(): void {
  let env: Env;
  try {
    env = loadEnv();
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }

  const sessions = new FileSessionStore(env.sessionsDir);
  const runner = new PlaywrightAuditRunner(sessions);
  const useCase = new RunAuditUseCase(runner, new ConcurrencyLimiter(env.maxConcurrent));
  const validate = createAuditRequestValidator({ allowedHosts: env.allowedHosts, sessions });
  const controller = new AuditController(useCase, validate);
  const app = createApp({
    auditRouter: createAuditRouter(controller, apiKeyGuard(env.apiKey)),
  });

  app.listen(env.port, () => console.log(`Auditor escuchando en :${env.port}`));
}

bootstrap();