// Expected vs projected gravity for a fermentation, shared by the fermentation chart and the AI Brewmaster's context.
//
//  - EXPECTED: the curve the recipe implies — from the starting gravity (OG) down to the expected final gravity
//    (FG) over the planned fermentation window, dropping fastest early on like a typical ferment.
//  - PROJECTED: the batch's own trend carried forward: an exponential decay toward the expected FG fitted to the
//    last day of readings. If the ferment has stalled, the projection stays flat above the FG; the gap between the
//    two lines at the end of the window is the early warning.

export type GravityReading = { time: number; gravity: number };
export type GravityTargets = { og: number; fg: number };

const HOUR = 3600000;
// How much of the OG→FG drop is left at the end of the window on the expected curve (3%).
const EXPECTED_DECAY = 3.5;
const TREND_WINDOW_MS = 24 * HOUR;
const TREND_MIN_SPAN_MS = 3 * HOUR;
const TREND_MIN_POINTS = 4;
const DEFAULT_ATTENUATION = 0.75;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// OG from the recipe or, failing that, the first reading; FG from the recipe, else the yeast's attenuation, else the
// recipe's ABV (only meaningful next to the recipe's own OG), else a typical 75% apparent attenuation.
export function resolveGravityTargets(input: {
  recipeOg?: number | null;
  recipeFg?: number | null;
  recipeAbv?: number | null;
  yeastAttenuation?: number | null;
  firstReading?: number | null;
}): GravityTargets | null {
  const og = input.recipeOg ?? input.firstReading ?? null;
  if (!og || og <= 1) {
    return null;
  }
  let fg: number;
  if (input.recipeFg != null && input.recipeFg < og) {
    fg = input.recipeFg;
  } else if (input.yeastAttenuation != null && input.yeastAttenuation > 0) {
    fg = og - (og - 1) * (input.yeastAttenuation / 100);
  } else if (input.recipeOg != null && input.recipeAbv != null && input.recipeAbv > 0) {
    fg = og - input.recipeAbv / 131.25;
  } else {
    fg = og - (og - 1) * DEFAULT_ATTENUATION;
  }
  fg = Math.max(0.99, fg);
  return fg < og ? { og, fg } : null;
}

export function expectedGravityAt(t: number, startMs: number, endMs: number, { og, fg }: GravityTargets): number {
  if (endMs <= startMs) {
    return fg;
  }
  const x = clamp((t - startMs) / (endMs - startMs), 0, 1);
  const shape = (Math.exp(-EXPECTED_DECAY * x) - Math.exp(-EXPECTED_DECAY)) / (1 - Math.exp(-EXPECTED_DECAY));
  return fg + (og - fg) * shape;
}

export type GravityProjection = {
  // Gravity the trend predicts at time t (>= the last reading).
  at: (t: number) => number;
  // The reading the projection starts from (recent readings averaged, to smooth sensor noise).
  current: number;
  // Fitted decay rate per hour; 0 means no measurable drop (stalled).
  ratePerHour: number;
};

// null when there isn't enough recent data to say anything (needs a few readings spread over a few hours).
export function projectGravity(readings: GravityReading[], floor: number): GravityProjection | null {
  if (readings.length === 0) {
    return null;
  }
  const last = readings[readings.length - 1];
  const recent = readings.filter((r) => last.time - r.time <= TREND_WINDOW_MS);
  if (recent.length < TREND_MIN_POINTS || last.time - recent[0].time < TREND_MIN_SPAN_MS) {
    return null;
  }
  const tail = recent.slice(-3);
  const current = tail.reduce((sum, r) => sum + r.gravity, 0) / tail.length;

  // Linear fit of ln(gravity - floor) against time (hours); a rising or flat trend means no drop.
  const above = recent.filter((r) => r.gravity - floor > 0.0005);
  let ratePerHour = 0;
  if (above.length >= TREND_MIN_POINTS && current - floor > 0.0005) {
    const xs = above.map((r) => (r.time - last.time) / HOUR);
    const ys = above.map((r) => Math.log(r.gravity - floor));
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
    const sxy = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0);
    const slope = sxx > 0 ? sxy / sxx : 0;
    ratePerHour = slope < 0 ? clamp(-slope, 0, 0.2) : 0;
  }
  const at = (t: number) => {
    const hours = Math.max(0, (t - last.time) / HOUR);
    return ratePerHour === 0 || current <= floor ? current : floor + (current - floor) * Math.exp(-ratePerHour * hours);
  };
  return { at, current, ratePerHour };
}

export function sampleCurve(fn: (t: number) => number, fromMs: number, toMs: number, points = 40) {
  if (toMs <= fromMs) {
    return [];
  }
  return Array.from({ length: points + 1 }, (_, i) => {
    const t = fromMs + ((toMs - fromMs) * i) / points;
    return { x: t, y: fn(t) };
  });
}
