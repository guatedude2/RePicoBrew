import { useRouteLoaderData } from 'react-router';

export type WeightUnit = 'oz' | 'g';

export const WEIGHT_UNIT_CONFIG_KEY = 'WEIGHT_UNIT';
export const DEFAULT_WEIGHT_UNIT: WeightUnit = 'oz';

export const parseWeightUnit = (value: unknown): WeightUnit => (value === 'g' ? 'g' : DEFAULT_WEIGHT_UNIT);

export const useWeightUnit = (): WeightUnit =>
  parseWeightUnit(useRouteLoaderData<typeof import('~/routes/_admin').loader>('routes/_admin')?.weightUnit);

const OUNCES_PER_GRAM = 1 / 28.349523125;

// Ingredient amounts are always stored in ounces (RecipeIngredient.amount) regardless of this
// setting — these two only convert at the UI boundary (display and user input), so no stored data
// or AI-generated recipe (which still reasons in ounces) needs to change.
export const ozToDisplay = (oz: number, unit: WeightUnit): number => {
  if (unit === 'oz') {
    return Math.round(oz * 100) / 100;
  }
  return Math.round(oz / OUNCES_PER_GRAM);
};

export const displayToOz = (value: number, unit: WeightUnit): number => {
  if (unit === 'oz') {
    return value;
  }
  return Math.round(value * OUNCES_PER_GRAM * 100) / 100;
};
