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
