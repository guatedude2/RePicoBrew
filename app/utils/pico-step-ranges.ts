// Safe operating ranges for a PicoPak machine program, measured from the official PicoBrew library
// (9,535 standard recipes, of ~10,000). Every official pak follows the same fixed shape:
//   Heating -> Dough In -> Mash 1 -> Mash 2 (-> Mash 3) -> Mash Out -> Hops 1..4
// The AI Brewmaster is told these ranges and its output is clamped to them, because an AI-rewritten
// schedule that strayed from them (Heating at 160°F for 15 min, no Mash 2, 45 min hop steps) is what
// produced a brew where the ThermoBlock kept overheating and the wort never warmed.

export type PicoStepRole = 'prepare' | 'heating' | 'doughIn' | 'mash' | 'mashOut' | 'hops' | 'other';

type Bounds = { min: number; max: number; typical: number };

export type PicoStepRange = {
  temperature: Bounds;
  stepTime: Bounds;
  drainTime: Bounds;
};

export const PICO_STEP_RANGES: Record<Exclude<PicoStepRole, 'prepare' | 'other'>, PicoStepRange> = {
  // Always 110°F for 0 min in 99% of paks: it only brings the water up to Dough In temperature.
  heating: {
    temperature: { min: 110, max: 110, typical: 110 },
    stepTime: { min: 0, max: 0, typical: 0 },
    drainTime: { min: 0, max: 0, typical: 0 },
  },
  doughIn: {
    temperature: { min: 110, max: 110, typical: 110 },
    stepTime: { min: 3, max: 20, typical: 7 },
    drainTime: { min: 0, max: 0, typical: 0 },
  },
  // Mash 1 is usually 148°F, Mash 2 156°F; the official paks range 131-159°F.
  mash: {
    temperature: { min: 131, max: 160, typical: 152 },
    stepTime: { min: 5, max: 60, typical: 25 },
    drainTime: { min: 0, max: 0, typical: 0 },
  },
  mashOut: {
    temperature: { min: 170, max: 178, typical: 176 },
    stepTime: { min: 5, max: 15, typical: 7 },
    drainTime: { min: 0, max: 3, typical: 2 },
  },
  // Hop additions run at the machine's boil temperature. Only the last one drains (5 min in 98%).
  hops: {
    temperature: { min: 170, max: 207, typical: 203 },
    stepTime: { min: 1, max: 35, typical: 10 },
    drainTime: { min: 0, max: 5, typical: 5 },
  },
};

export const MAX_MASH_STEPS = 3;
export const MAX_HOP_STEPS = 4;

export function classifyPicoStep(name: string): PicoStepRole {
  const n = name.trim().toLowerCase();
  if (n === 'preparing to brew') {
    return 'prepare';
  }
  if (n === 'heating') {
    return 'heating';
  }
  if (n === 'dough in') {
    return 'doughIn';
  }
  if (n.includes('mash out')) {
    return 'mashOut';
  }
  if (n.includes('mash')) {
    return 'mash';
  }
  if (n.includes('hop') || n.includes('adjunct') || n.includes('whirlpool') || n.includes('boil')) {
    return 'hops';
  }
  return 'other';
}

// The order every official recipe follows; used to put AI-produced steps back in sequence.
export const PICO_STEP_ORDER: Record<PicoStepRole, number> = {
  prepare: 0,
  heating: 1,
  doughIn: 2,
  mash: 3,
  mashOut: 4,
  hops: 5,
  other: 5,
};

const clamp = (value: number, b: Bounds) => Math.min(b.max, Math.max(b.min, value));

export function clampToStepRange(
  role: PicoStepRole,
  step: { temperature: number; stepTime: number; drainTime: number },
): { temperature: number; stepTime: number; drainTime: number } {
  if (role === 'prepare' || role === 'other') {
    return step;
  }
  const range = PICO_STEP_RANGES[role];
  return {
    temperature: clamp(step.temperature, range.temperature),
    stepTime: clamp(step.stepTime, range.stepTime),
    drainTime: clamp(step.drainTime, range.drainTime),
  };
}

// Plain-language version of the ranges above, injected into the AI Brewmaster's system prompt so it
// designs within them instead of only being corrected afterwards.
export function describePicoStepRangesForPrompt(): string {
  const r = PICO_STEP_RANGES;
  return `STEP SHAPE AND SAFE RANGES — measured from the ~9,500 official PicoBrew recipes. Every official recipe has this
exact order: Preparing To Brew, Heating, Dough In, Mash 1, Mash 2 (a third mash step is rare), Mash Out, then Hops 1
through Hops 4 (2-4 hop additions; a Pico has only 4 hop compartments). Never reorder them, never add other step
types, and never skip Mash Out.
  - Heating: always ${r.heating.temperature.typical}°F for ${r.heating.stepTime.typical} min. It only warms the water to Dough In
    temperature — it is NOT a mash step. Never raise its temperature or give it a duration.
  - Dough In: always ${r.doughIn.temperature.typical}°F, ${r.doughIn.stepTime.min}-${r.doughIn.stepTime.max} min (usually ${r.doughIn.stepTime.typical}).
  - Mash 1: ${r.mash.temperature.min}-${r.mash.temperature.max}°F (usually 148°F), ${r.mash.stepTime.min}-${r.mash.stepTime.max} min (usually 15-35).
    Mash 2: a step up from Mash 1 (usually 156°F), ${r.mash.stepTime.min}-${r.mash.stepTime.max} min (usually 10-30). Lower mash temperature = drier, higher = fuller body.
  - Mash Out: ${r.mashOut.temperature.min}-${r.mashOut.temperature.max}°F (usually ${r.mashOut.temperature.typical}°F), ${r.mashOut.stepTime.min}-${r.mashOut.stepTime.max} min (usually ${r.mashOut.stepTime.typical}), drain ${r.mashOut.drainTime.min}-${r.mashOut.drainTime.max} min (usually ${r.mashOut.drainTime.typical}).
  - Hops 1-4: ${r.hops.temperature.min}-${r.hops.temperature.max}°F (almost always ${r.hops.temperature.typical}°F), ${r.hops.stepTime.min}-${r.hops.stepTime.max} min each (usually 5-15). Only the LAST hop step drains (usually ${r.hops.drainTime.typical} min);
    earlier hop steps drain 0. Change bitterness by moving hop amounts or the step's minutes, never by
    lengthening one addition past ${r.hops.stepTime.max} min.
  - A whole brew is usually 90-115 minutes (never over about 140).
If a request would need values outside these ranges, keep the step inside the range, say so in "explanation", and
suggest the closest in-range alternative. Values outside these ranges have run the machine into overheating and
failed brews.`;
}

export type PicoStepWarning = { stepIndex: number | null; message: string };

type WarnableStep = { name: string; temperature: number; stepTime: number; drainTime: number };

// Advisory only (never blocks a save): flags machine steps that fall outside what the official PicoBrew
// recipes do. stepIndex is the row to highlight, or null for a warning about the recipe as a whole.
export function getPicoStepWarnings(steps: WarnableStep[]): PicoStepWarning[] {
  const warnings: PicoStepWarning[] = [];
  const roles = steps.map((s) => classifyPicoStep(s.name));
  let totalMinutes = 0;

  steps.forEach((step, index) => {
    const role = roles[index];
    totalMinutes += step.stepTime + step.drainTime;
    if (role === 'prepare' || role === 'other') {
      return;
    }
    const range = PICO_STEP_RANGES[role];
    const isLastStep = index === steps.length - 1;
    const check = (label: string, unit: string, value: number, b: Bounds) => {
      if (value >= b.min && value <= b.max) {
        return;
      }
      const allowed = b.min === b.max ? `${b.min}${unit}` : `${b.min}-${b.max}${unit}`;
      warnings.push({
        stepIndex: index,
        message: `${step.name}: ${label} ${value}${unit} is outside what official PicoPaks use (${allowed}).`,
      });
    };
    check('temperature', '°F', step.temperature, range.temperature);
    check('time', ' min', step.stepTime, range.stepTime);
    if (role === 'mashOut' || (role === 'hops' && isLastStep)) {
      check('drain time', ' min', step.drainTime, range.drainTime);
    }
  });

  const firstIndex = (role: PicoStepRole) => roles.indexOf(role);
  const lastIndex = (role: PicoStepRole) => roles.lastIndexOf(role);
  const inOrder = roles.every((role, i) => i === 0 || PICO_STEP_ORDER[role] >= PICO_STEP_ORDER[roles[i - 1]]);
  if (!inOrder) {
    warnings.push({
      stepIndex: null,
      message:
        'Steps are out of the usual order. Official recipes always run Heating, Dough In, Mash, Mash Out, then the hop additions.',
    });
  }
  if (steps.length > 0 && firstIndex('mashOut') === -1) {
    warnings.push({ stepIndex: null, message: 'There is no Mash Out step; every official recipe has one.' });
  }
  if (roles.filter((r) => r === 'mash').length > MAX_MASH_STEPS) {
    warnings.push({ stepIndex: null, message: `Official recipes use at most ${MAX_MASH_STEPS} mash steps.` });
  }
  if (roles.filter((r) => r === 'hops').length > MAX_HOP_STEPS) {
    warnings.push({ stepIndex: null, message: `A Pico has only ${MAX_HOP_STEPS} hop compartments.` });
  }
  const hopsEarlyDrain = roles.findIndex((r, i) => r === 'hops' && i !== lastIndex('hops') && steps[i].drainTime > 0);
  if (hopsEarlyDrain !== -1) {
    warnings.push({
      stepIndex: hopsEarlyDrain,
      message: `${steps[hopsEarlyDrain].name}: only the last hop step should drain.`,
    });
  }
  if (totalMinutes > 140) {
    warnings.push({
      stepIndex: null,
      message: `The whole brew runs ${totalMinutes} min; official recipes are 90-115 (never over about 140).`,
    });
  }
  return warnings;
}
