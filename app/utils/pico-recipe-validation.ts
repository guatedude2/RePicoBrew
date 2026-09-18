import { PicoLocationMap } from '~/types';

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
  { name: 'Heating', location: PicoLocationMap.Mash, temperature: 156, stepTime: 15, drainTime: 0 },
  { name: 'Dough In', location: PicoLocationMap.Mash, temperature: 152, stepTime: 20, drainTime: 0 },
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

// Forces any AI-produced (or otherwise untrusted) machine step sequence into the shape
// validatePicoRecipe requires: first 3 steps exactly Preparing To Brew@Prime / Heating@Mash /
// Dough In@Mash, and drainTime 0 on every step except a Mash Out step or the final hop-addition
// step. The result always passes validatePicoRecipe.
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

  const isHeating = (n: string) => n.toLowerCase() === 'heating';
  const isDoughIn = (n: string) => n.toLowerCase() === 'dough in';
  const isPreparing = (n: string) => n.toLowerCase() === 'preparing to brew';

  // Reuse the AI's own Heating/Dough In temp+time if it supplied them (recipes legitimately vary
  // mash-in temperature/duration), but always force the name/location/drainTime the validator
  // requires.
  const heatingMatch = cleaned.find((s) => isHeating(s.name));
  const doughInMatch = cleaned.find((s) => isDoughIn(s.name));

  const forcedFirst: PicoRecipeStep[] = [
    { ...REQUIRED_FIRST_STEPS[0] },
    {
      ...REQUIRED_FIRST_STEPS[1],
      temperature: heatingMatch ? heatingMatch.temperature : REQUIRED_FIRST_STEPS[1].temperature,
      stepTime: heatingMatch ? heatingMatch.stepTime : REQUIRED_FIRST_STEPS[1].stepTime,
    },
    {
      ...REQUIRED_FIRST_STEPS[2],
      temperature: doughInMatch ? doughInMatch.temperature : REQUIRED_FIRST_STEPS[2].temperature,
      stepTime: doughInMatch ? doughInMatch.stepTime : REQUIRED_FIRST_STEPS[2].stepTime,
    },
  ];

  // Everything else the AI produced, minus whatever we just consumed as Heating/Dough In and any
  // duplicate "Preparing To Brew" it may have invented, in original order.
  const rest = cleaned.filter((s) => s !== heatingMatch && s !== doughInMatch && !isPreparing(s.name));

  const combined = [...forcedFirst, ...rest];

  return combined.map((step, index) => {
    const isMashOut = step.name.toLowerCase().includes('mash out');
    const isLastHop = step.name.toLowerCase().includes('hop') && index === combined.length - 1;
    return {
      ...step,
      temperature: Math.min(215, Math.max(32, Math.round(step.temperature))),
      stepTime: Math.min(180, Math.max(0, Math.round(step.stepTime))),
      drainTime: isMashOut || isLastHop ? Math.min(30, Math.max(0, Math.round(step.drainTime))) : 0,
    };
  });
}
