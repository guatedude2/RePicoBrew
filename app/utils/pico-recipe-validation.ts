import { PicoLocationMap } from '~/types';
import {
  classifyPicoStep,
  clampToStepRange,
  MAX_HOP_STEPS,
  MAX_MASH_STEPS,
  PICO_STEP_ORDER,
  PICO_STEP_RANGES,
} from '~/utils/pico-step-ranges';

export type PicoRecipeStep = {
  name: string;
  temperature: number;
  stepTime: number;
  drainTime: number;
  location: number;
};

// Validates the machine-facing step program against the real Pico wire-protocol constraints.
// Shared (non-`.server`) so both the client-side recipe editor and the server action can use it.
export function validatePicoRecipe(steps: PicoRecipeStep[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (steps.length < 3) {
    errors.push('Recipe must have at least 3 steps (Preparing, Heating, Dough In)');
  }

  // First 3 steps must be: Preparing To Brew, Heating, Dough In
  const requiredSteps = [
    { name: 'Preparing To Brew', location: PicoLocationMap.Prime },
    { name: 'Heating', location: PicoLocationMap.Mash },
    { name: 'Dough In', location: PicoLocationMap.Mash },
  ];

  requiredSteps.forEach((required, index) => {
    if (steps[index] && steps[index].name !== required.name) {
      errors.push(`Step ${index + 1} must be "${required.name}"`);
    }
    if (steps[index] && steps[index].location !== required.location) {
      errors.push(`Step ${index + 1} must use location ${required.location}`);
    }
  });

  // Drain times should be 0 except for specific steps
  steps.forEach((step, index) => {
    const isMashOut = step.name.toLowerCase().includes('mash out');
    const isLastHop = step.name.toLowerCase().includes('hop') && index === steps.length - 1;

    if (!isMashOut && !isLastHop && step.drainTime > 0) {
      errors.push(`${step.name}: drain time should be 0 (except Mash Out and last hop)`);
    }
  });

  return { valid: errors.length === 0, errors };
}

// ---- AI-generated step normalization ----
//
// An LLM asked to freeform-generate a Pico machine step program will not reliably satisfy
// validatePicoRecipe's constraints on every call (right first-3-steps, right drain times). Rather
// than relying on prompt engineering alone, the AI Brewmaster recipe generator (see
// ai-recipe-generator.server.ts) runs every response through this deterministic pass, which
// forces those constraints regardless of what the model produced — mirroring the same convention
// api.picobrew-recipes.ts's mapPicoPakToRecipeInput applies when importing external PicoPak
// recipes that don't follow it either.

// Loosely-typed mirror of PicoRecipeStep for untrusted AI/JSON input — every field is `unknown`
// until validated/coerced.
export type RawPicoStep = {
  name?: unknown;
  temperature?: unknown;
  stepTime?: unknown;
  drainTime?: unknown;
  location?: unknown;
};

const REQUIRED_FIRST_STEPS: PicoRecipeStep[] = [
  { name: 'Preparing To Brew', location: PicoLocationMap.Prime, temperature: 70, stepTime: 3, drainTime: 0 },
  {
    name: 'Heating',
    location: PicoLocationMap.Mash,
    temperature: PICO_STEP_RANGES.heating.temperature.typical,
    stepTime: PICO_STEP_RANGES.heating.stepTime.typical,
    drainTime: 0,
  },
  {
    name: 'Dough In',
    location: PicoLocationMap.Mash,
    temperature: PICO_STEP_RANGES.doughIn.temperature.typical,
    stepTime: PICO_STEP_RANGES.doughIn.stepTime.typical,
    drainTime: 0,
  },
];

const VALID_LOCATIONS = new Set<number>(
  Object.values(PicoLocationMap).filter((v): v is number => typeof v === 'number'),
);

function toFiniteNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// Best-effort location guess for a step whose AI-provided `location` was missing or not one of
// the real wire-protocol values, based on what the step's name suggests it does.
function inferLocation(name: string): number {
  const n = name.toLowerCase();
  if (n.includes('hop') || n.includes('adjunct') || n.includes('whirlpool')) {
    return PicoLocationMap.Adjunct1;
  }
  return PicoLocationMap.Mash;
}

// Forces any AI-produced (or otherwise untrusted) machine step sequence into the shape official
// PicoPaks always have (see pico-step-ranges.ts): first 3 steps exactly Preparing To Brew@Prime /
// Heating@Mash / Dough In@Mash, the rest in the fixed order mash -> mash out -> hops (at most 3 mash
// and 4 hop steps), every value clamped to the range seen in the official library, and drainTime 0
// except on a Mash Out step or the final hop-addition step. The result always passes validatePicoRecipe.
export function normalizeMachineSteps(rawSteps: RawPicoStep[] | null | undefined): PicoRecipeStep[] {
  const cleaned: PicoRecipeStep[] = (Array.isArray(rawSteps) ? rawSteps : [])
    .filter((s): s is RawPicoStep => !!s && typeof s === 'object')
    .map((s) => {
      const name = typeof s.name === 'string' && s.name.trim() ? s.name.trim() : 'Step';
      const location = VALID_LOCATIONS.has(Number(s.location)) ? Number(s.location) : inferLocation(name);
      return {
        name,
        temperature: toFiniteNumber(s.temperature, 152),
        stepTime: toFiniteNumber(s.stepTime, 10),
        drainTime: toFiniteNumber(s.drainTime, 0),
        location,
      };
    });

  const doughInMatch = cleaned.find((s) => classifyPicoStep(s.name) === 'doughIn');

  const forcedFirst: PicoRecipeStep[] = [
    { ...REQUIRED_FIRST_STEPS[0] },
    { ...REQUIRED_FIRST_STEPS[1] },
    {
      ...REQUIRED_FIRST_STEPS[2],
      stepTime: doughInMatch ? doughInMatch.stepTime : REQUIRED_FIRST_STEPS[2].stepTime,
    },
  ];

  // Everything the AI produced beyond the three forced steps (its own Preparing To Brew / Heating /
  // Dough In are replaced above), put back in the official order; the sort is stable so steps of
  // the same kind keep the order the AI gave them.
  const rest = cleaned
    .filter((s) => !['prepare', 'heating', 'doughIn'].includes(classifyPicoStep(s.name)))
    .map((s, i) => ({ s, i, role: classifyPicoStep(s.name) }))
    .sort((a, b) => PICO_STEP_ORDER[a.role] - PICO_STEP_ORDER[b.role] || a.i - b.i);

  let mashCount = 0;
  let hopCount = 0;
  const kept = rest
    .filter(({ role }) => {
      if (role === 'mash') {
        return ++mashCount <= MAX_MASH_STEPS;
      }
      if (role === 'hops') {
        return ++hopCount <= MAX_HOP_STEPS;
      }
      return true;
    })
    .map(({ s }) => s);

  const combined = [...forcedFirst, ...kept];

  return combined.map((step, index) => {
    const role = classifyPicoStep(step.name);
    const isLastHop = role === 'hops' && index === combined.length - 1;
    const canDrain = role === 'mashOut' || isLastHop;
    const clamped = clampToStepRange(role, {
      temperature: Math.round(step.temperature),
      stepTime: Math.round(step.stepTime),
      drainTime: canDrain ? Math.round(step.drainTime) : 0,
    });
    return {
      ...step,
      temperature: Math.min(215, Math.max(32, clamped.temperature)),
      stepTime: Math.min(180, Math.max(0, clamped.stepTime)),
      drainTime: canDrain ? Math.min(30, Math.max(0, clamped.drainTime)) : 0,
    };
  });
}
