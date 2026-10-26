import type {
  NavigationTiming,
  RawAuditData,
  StepResult,
  Verdict,
} from "../types.js";
import { summarizeMedia, type MediaSummary } from "./media-summary.js";
import { summarizeNetwork, type NetworkSummary } from "./network-summary.js";
import { evaluate } from "./verdict-policy.js";

export interface AuditReport {
  url: string;
  auditedAt: string;
  verdict: Verdict;
  warnings: string[];
  pageLoad: { totalMs: number } & Partial<NavigationTiming>;
  network: NetworkSummary;
  media: MediaSummary;
  interactions: StepResult[];
  console: { errors: string[]; pageErrors: string[] };
  mediaProcessing?: {
    success: boolean;
    file?: string;
    fileName?: string;
    error?: string;
  };
}

// Solo compone: cada resumen vive en su propio archivo.
export function buildReport(raw: RawAuditData): AuditReport {
  const { verdict, warnings } = evaluate(raw);
  return {
    url: raw.url,
    auditedAt: raw.auditedAt,
    verdict,
    warnings,
    pageLoad: { totalMs: raw.loadMs, ...(raw.navigation ?? {}) },
    network: summarizeNetwork(raw.requests),
    media: summarizeMedia(raw.requests, raw.videos),
    interactions: raw.steps,
    console: { errors: raw.consoleErrors, pageErrors: raw.pageErrors },
  };
}
