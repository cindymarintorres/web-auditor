export const STEP_TYPES = ['click', 'fill', 'waitForSelector', 'wait', 'goto', 'play'] as const;
export type StepType = (typeof STEP_TYPES)[number];

export const URL_MODES = ['strip', 'keys'] as const;
export type UrlMode = (typeof URL_MODES)[number];

/** 'manifest' | 'media-segment' | 'api', o el resourceType de Playwright (document, script, image...) */
export type RequestCategory = string;

export interface AuditStep {
  type: StepType;
  selector?: string;
  value?: string;
  url?: string;
  ms?: number;
  frame?: string; // selector CSS del iframe donde ejecutar el paso
  nth?: number; // cuál elemento si el selector coincide con varios
  timeoutMs?: number;
}

export interface AuditRequest {
  url: string;
  steps?: AuditStep[];
  session?: string;
  urlMode?: UrlMode;
  settleMs?: number;
  navTimeoutMs?: number;
  stepTimeoutMs?: number;
}

/** Paso ya "limpio" para devolverlo en el reporte: nunca expone lo escrito en un fill. */
export type RedactedStep = Omit<AuditStep, 'value'> & { value?: '***' };

export type StepResult = RedactedStep & {
  index: number;
  ok: boolean;
  durationMs: number;
  error?: string;
};

export interface NetworkRecord {
  url: string;
  method: string;
  category: RequestCategory;
  status: number | null;
  ttfbMs: number | null;
  durationMs: number;
  failed: boolean;
  failure?: string;
}

export interface NavigationTiming {
  ttfbMs: number;
  domContentLoadedMs: number;
  loadEventMs: number;
  paint: Record<string, number>;
}

export interface VideoHealth {
  frame: string;
  readyState: number;
  networkState: number;
  paused: boolean;
  currentTime: number;
  duration: number | null;
  width: number;
  height: number;
  playing: boolean;
  error: { code: number; message: string } | null;
}

/** Datos crudos que entrega el runner; el dominio los convierte en reporte. */
export interface RawAuditData {
  url: string;
  auditedAt: string;
  usedSession: boolean;
  redirected: boolean;
  landedUrl: string;
  loadMs: number;
  navigation: NavigationTiming | null;
  steps: StepResult[];
  manifests: string[];
  requests: NetworkRecord[];
  videos: VideoHealth[];
  consoleErrors: string[];
  pageErrors: string[];
}

export type Verdict = 'pass' | 'warn' | 'fail';