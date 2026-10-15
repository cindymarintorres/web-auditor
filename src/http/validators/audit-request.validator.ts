import type { SessionStore } from '../../application/ports/session-store.port.js';
import { isValidSessionName } from '../../domain/session-name.js';
import {
  STEP_TYPES,
  URL_MODES,
  type AuditRequest,
  type AuditStep,
  type StepType,
  type UrlMode,
} from '../../domain/types.js';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const NEEDS_SELECTOR: StepType[] = ['click', 'fill', 'waitForSelector'];
const MAX_STEPS = 30;

export interface ValidatorOptions {
  allowedHosts: string[];
  sessions: SessionStore;
}

export function createAuditRequestValidator({ allowedHosts, sessions }: ValidatorOptions) {
  const hostAllowed = (hostname: string): boolean =>
    allowedHosts.length === 0 || allowedHosts.includes(hostname);

  const parseHttpUrl = (raw: unknown): URL | null => {
    if (typeof raw !== 'string') return null;
    try {
      const u = new URL(raw);
      return u.protocol === 'http:' || u.protocol === 'https:' ? u : null;
    } catch {
      return null;
    }
  };

  const optionalNumber = (value: unknown, label: string): number | undefined => {
    if (value === undefined) return undefined;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new ValidationError(`${label} debe ser un número >= 0`);
    }
    return value;
  };

  const optionalString = (value: unknown, label: string): string | undefined => {
    if (value === undefined) return undefined;
    if (typeof value !== 'string') throw new ValidationError(`${label} debe ser texto`);
    return value;
  };

  const parseStep = (raw: unknown, i: number): AuditStep => {
    if (typeof raw !== 'object' || raw === null) {
      throw new ValidationError(`Paso ${i}: debe ser un objeto`);
    }
    const s = raw as Record<string, unknown>;
    if (!STEP_TYPES.includes(s.type as StepType)) {
      throw new ValidationError(`Paso ${i}: tipo inválido (${STEP_TYPES.join(', ')})`);
    }
    const type = s.type as StepType;
    const where = `Paso ${i}`;

    const step: AuditStep = {
      type,
      selector: optionalString(s.selector, `${where}: "selector"`),
      value: optionalString(s.value, `${where}: "value"`),
      frame: optionalString(s.frame, `${where}: "frame"`),
      url: optionalString(s.url, `${where}: "url"`),
      ms: optionalNumber(s.ms, `${where}: "ms"`),
      timeoutMs: optionalNumber(s.timeoutMs, `${where}: "timeoutMs"`),
      nth: optionalNumber(s.nth, `${where}: "nth"`),
    };

    if (step.nth !== undefined && !Number.isInteger(step.nth)) {
      throw new ValidationError(`${where}: "nth" debe ser un entero`);
    }
    if (NEEDS_SELECTOR.includes(type) && !step.selector) {
      throw new ValidationError(`${where}: falta "selector"`);
    }
    if (type === 'goto') {
      const u = parseHttpUrl(step.url);
      if (!u) throw new ValidationError(`${where}: "url" inválida`);
      if (!hostAllowed(u.hostname)) {
        throw new ValidationError(`${where}: host no permitido (${u.hostname})`);
      }
    }
    return step;
  };

  return function validate(body: unknown): AuditRequest {
    if (typeof body !== 'object' || body === null) {
      throw new ValidationError('El body debe ser un objeto JSON');
    }
    const b = body as Record<string, unknown>;

    if (b.url === undefined) throw new ValidationError('Falta "url"');
    const main = parseHttpUrl(b.url);
    if (!main) throw new ValidationError('"url" no es válida (solo http/https)');
    if (!hostAllowed(main.hostname)) {
      throw new ValidationError(`Host no permitido: ${main.hostname}`);
    }

    if (b.urlMode !== undefined && !URL_MODES.includes(b.urlMode as UrlMode)) {
      throw new ValidationError(`"urlMode" debe ser uno de: ${URL_MODES.join(', ')}`);
    }

    // Solo validamos la sesión si la mandaron
    if (b.session !== undefined) {
      if (!isValidSessionName(b.session)) {
        throw new ValidationError('"session" inválida (solo letras, números, - y _)');
      }
      if (!sessions.exists(b.session)) {
        throw new ValidationError(`No existe la sesión "${b.session}"`);
      }
    }

    let steps: AuditStep[] | undefined;
    if (b.steps !== undefined) {
      if (!Array.isArray(b.steps)) throw new ValidationError('"steps" debe ser un array');
      if (b.steps.length > MAX_STEPS) throw new ValidationError(`Máximo ${MAX_STEPS} pasos`);
      steps = b.steps.map(parseStep);
    }

    return {
      url: b.url as string,
      steps,
      session: b.session as string | undefined,
      urlMode: b.urlMode as UrlMode | undefined,
      settleMs: optionalNumber(b.settleMs, '"settleMs"'),
      navTimeoutMs: optionalNumber(b.navTimeoutMs, '"navTimeoutMs"'),
      stepTimeoutMs: optionalNumber(b.stepTimeoutMs, '"stepTimeoutMs"'),
    };
  };
}