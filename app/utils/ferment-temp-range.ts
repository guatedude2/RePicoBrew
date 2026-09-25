// The temperature range a recipe recommends for fermentation, shared by the fermentation chart, the recipe editors
// and the AI Brewmaster's context.
//
// Recipes carry it as the yeast's range in `yeastRangeTemp`, written "min-max" in °F (e.g. "64-72", the PicoBrew
// format; a "°C" suffix is converted). When a recipe has none, its fermentation type (ale/lager) gives a typical range.

export type TempRange = { min: number; max: number };
export type RecommendedTemp = { range: TempRange; source: 'yeast' | 'type' };

const MIN_PLAUSIBLE_F = 30;
const MAX_PLAUSIBLE_F = 120;
// Recipe.fermentationType: 0 = ale, 1 = lager.
const TYPE_DEFAULTS: Record<number, TempRange> = {
  0: { min: 64, max: 72 },
  1: { min: 46, max: 58 },
};

const toF = (c: number) => Math.round((c * 9) / 5 + 32);

export function parseTempRange(raw: string | null | undefined): TempRange | null {
  if (!raw) {
    return null;
  }
  const numbers = raw.match(/\d+(?:\.\d+)?/g);
  if (!numbers || numbers.length < 2) {
    return null;
  }
  let min = Number(numbers[0]);
  let max = Number(numbers[1]);
  if (/c/i.test(raw) && !/f/i.test(raw)) {
    min = toF(min);
    max = toF(max);
  }
  if (min > max) {
    [min, max] = [max, min];
  }
  if (min < MIN_PLAUSIBLE_F || max > MAX_PLAUSIBLE_F || min === max) {
    return null;
  }
  return { min: Math.round(min), max: Math.round(max) };
}

export function formatTempRange(min: number, max: number): string {
  return `${Math.round(min)}-${Math.round(max)}`;
}

export function resolveRecommendedTemp(recipe: {
  yeastRangeTemp?: string | null;
  fermentationType?: number | null;
}): RecommendedTemp | null {
  const fromYeast = parseTempRange(recipe.yeastRangeTemp);
  if (fromYeast) {
    return { range: fromYeast, source: 'yeast' };
  }
  const fromType = recipe.fermentationType != null ? TYPE_DEFAULTS[recipe.fermentationType] : undefined;
  return fromType ? { range: fromType, source: 'type' } : null;
}
