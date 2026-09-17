// Known limitation: the picobrew_pico reference README documents PicoFerm sessions
// auto-terminating after 14 days, but that logic was NOT found in routes_picoferm_api.py itself —
// it appears to live elsewhere (unresearched). RePicoBrew has no such external mechanism to flip a
// session inactive the way the reference's frontend apparently does, so we approximate it here:
// once the *current* fermentation-tracking session has been running this long, a logDataSet call
// is treated the same as an externally-ended session (respond '#2,4#', stop accepting data).
export const PICOFERM_SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export function isPicoFermSessionExpired(session: { createdAt: Date | string }): boolean {
  return Date.now() - new Date(session.createdAt).getTime() >= PICOFERM_SESSION_MAX_AGE_MS;
}

export interface PicoFermDataPoint {
  s1: number; // temperature
  s2: number; // pressure
}

export interface PicoFermLogEntry {
  time: number;
  temp: number;
  pressure: number;
}

/**
 * PicoFerm sends a batch of {s1: temp, s2: pressure} points plus a sample `rate` (minutes between
 * samples) but no per-point timestamp. Back-calculate each point's time assuming the last point in
 * the batch was sampled "now", counting backward by rate*60*1000 ms per point.
 */
export function backfillPicoFermTimestamps(points: PicoFermDataPoint[], rateMinutes: number): PicoFermLogEntry[] {
  const rateMs = rateMinutes * 60 * 1000;
  const now = Date.now();
  return points.map((point, index) => ({
    time: now - rateMs * (points.length - 1 - index),
    temp: point.s1,
    pressure: point.s2,
  }));
}
