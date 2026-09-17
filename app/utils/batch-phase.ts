import { BatchPhase } from '~/types';

// oklch channel triples (no wrapping fn), matching the design's exact per-phase colors so both
// the Dashboard/Sessions pills and StatCard accents can compose bg/border/text from one source.
export const PHASE_ACCENT: Record<BatchPhase, string> = {
  [BatchPhase.BREWING]: '0.78 0.135 65',
  [BatchPhase.COOLING]: '0.75 0.09 220',
  [BatchPhase.FERMENTING]: '0.72 0.1 235',
  [BatchPhase.BOTTLING]: '0.75 0.11 155',
  [BatchPhase.CARBONATING]: '0.75 0.13 100',
  [BatchPhase.COMPLETED]: '0.72 0.14 145',
  [BatchPhase.CANCELED]: '0.7 0.16 25',
};

export const PHASE_LABEL: Record<BatchPhase, string> = {
  [BatchPhase.BREWING]: 'BREWING',
  [BatchPhase.COOLING]: 'COOLING',
  [BatchPhase.FERMENTING]: 'FERMENTING',
  [BatchPhase.BOTTLING]: 'BOTTLING',
  [BatchPhase.CARBONATING]: 'CARBONATING',
  [BatchPhase.COMPLETED]: 'COMPLETED',
  [BatchPhase.CANCELED]: 'CANCELED',
};

export const phaseAccent = (phase: string) => PHASE_ACCENT[phase as BatchPhase] ?? '0.55 0.008 260';
export const phaseLabel = (phase: string) => PHASE_LABEL[phase as BatchPhase] ?? phase.toUpperCase();

const FERMENTATION_SESSION_TYPE = 3;
const carbMsFor = (duration: number, unit: string | null) =>
  unit === 'hours' ? duration * 3600000 : duration * 7 * 86400000;

// True once a batch is just sitting there waiting on the user — cooling and bottling are both
// fully manual with no automatic exit, so they always need a click; fermenting needs one once its
// estimated window has elapsed; carbonating needs one once it was never configured or its
// countdown finished with no one clicking "Done".
export function batchNeedsAttention(batch: {
  phase: string;
  updatedAt: string | Date;
  carbStatus: string | null;
  carbDuration: number | null;
  carbUnit: string | null;
  carbStartedAt: string | Date | null;
  carbExtendMinutes: number | null;
  recipe: { fermentDays: number | null } | null;
  sessions: Array<{ type: number; state: number; createdAt: string | Date }>;
}): boolean {
  if (batch.phase === BatchPhase.COOLING || batch.phase === BatchPhase.BOTTLING) {
    return true;
  }
  if (batch.phase === BatchPhase.FERMENTING) {
    const fermSession = batch.sessions.find((s) => s.type === FERMENTATION_SESSION_TYPE);
    const fermStart = new Date(fermSession?.createdAt ?? batch.updatedAt).getTime();
    const fermMs = (batch.recipe?.fermentDays ?? 7) * 86400000;
    return Date.now() - fermStart >= fermMs;
  }
  if (batch.phase === BatchPhase.CARBONATING) {
    if (!batch.carbStatus || batch.carbStatus === 'setup') {
      return true;
    }
    if (batch.carbStatus === 'counting') {
      const totalMs = carbMsFor(batch.carbDuration ?? 0, batch.carbUnit) + (batch.carbExtendMinutes ?? 0) * 60000;
      const startedMs = new Date(batch.carbStartedAt ?? batch.updatedAt).getTime();
      return Date.now() - startedMs >= totalMs;
    }
  }
  return false;
}

const clampPct = (start: number, totalMs: number) =>
  totalMs > 0 ? Math.max(0, Math.min(99, Math.round(((Date.now() - start) / totalMs) * 100))) : 0;

// Rough progress for the batch's current phase, derived from real elapsed time vs. an estimated
// duration — shared by the Dashboard's ongoing-brews list and the Session Detail header so both
// show the same number for a given batch.
export function batchOverallProgress(batch: {
  phase: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  carbDuration: number | null;
  carbUnit: string | null;
  carbStartedAt: string | Date | null;
  recipe: { fermentDays: number | null; steps: Array<{ stepTime: number; drainTime: number }> } | null;
  sessions: Array<{ type: number; createdAt: string | Date }>;
}): number {
  if (batch.phase === BatchPhase.COMPLETED) {
    return 100;
  }
  if (batch.phase === BatchPhase.CANCELED) {
    return 0;
  }
  if (batch.phase === BatchPhase.BREWING) {
    const brewMs = (batch.recipe?.steps ?? []).reduce((sum, s) => sum + s.stepTime + s.drainTime, 0) * 60000;
    return clampPct(new Date(batch.createdAt).getTime(), brewMs);
  }
  if (batch.phase === BatchPhase.COOLING) {
    return clampPct(new Date(batch.updatedAt).getTime(), 24 * 3600000);
  }
  if (batch.phase === BatchPhase.FERMENTING) {
    const fermSession = batch.sessions.find((s) => s.type === FERMENTATION_SESSION_TYPE);
    const fermStart = new Date(fermSession?.createdAt ?? batch.updatedAt).getTime();
    const fermMs = (batch.recipe?.fermentDays ?? 7) * 86400000;
    return clampPct(fermStart, fermMs);
  }
  if (batch.phase === BatchPhase.BOTTLING) {
    return 0;
  }
  // Carbonating
  const carbMs = batch.carbDuration ? carbMsFor(batch.carbDuration, batch.carbUnit ?? 'weeks') : 14 * 86400000;
  const carbStart = new Date(batch.carbStartedAt ?? batch.updatedAt).getTime();
  return clampPct(carbStart, carbMs);
}
