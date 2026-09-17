import omit from 'lodash/omit';
import prisma from '~/services/prisma.server';
import { IngredientSection, PicoLocationMap } from '~/types';
import { validatePicoRecipe } from '~/utils/pico-recipe-validation';

export { IngredientSection, PicoLocationMap };

export type RecipeStep = {
  name: string;
  temperature: number;
  stepTime: number;
  drainTime: number;
  location: number;
};

export type IngredientRow = {
  section: IngredientSection;
  sortOrder?: number;
  name: string;
  amount?: number | null;
  unit?: string | null;
  color?: number | null;
  aa?: number | null;
  time?: number | null;
  temp?: number | null;
  days?: number | null;
  hours?: number | null;
};

export type CreateRecipeInput = {
  name: string;
  deviceType: string;
  abv: number;
  ibu: number;
  style?: string;
  og?: number;
  fg?: number;
  colorSRM?: number;
  fermentDays?: number;
  image: string;
  notes?: string;
  steps: RecipeStep[];

  photoUrl?: string | null;
  ogMin?: number;
  ogMax?: number;
  fgMin?: number;
  fgMax?: number;
  ibuMin?: number;
  ibuMax?: number;
  srmMin?: number;
  srmMax?: number;
  abvMin?: number;
  abvMax?: number;
  batchSize?: number;
  mashType?: number;
  boilTime?: number;
  boilTemp?: number;
  firstWortHopping?: boolean;
  fermentationType?: number;
  yeastName?: string;
  yeastAttenuation?: number;
  yeastRangeTemp?: string;
  yeastPitchTemp?: number;
  ingredients: IngredientRow[];
};

export class RecipeRepository {
  public static async getAllRecipes(deviceType?: string) {
    return await prisma.recipe.findMany({
      where: {
        deletedAt: null,
        ...(deviceType && { deviceType }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Same as getAllRecipes, but with steps included so callers can estimate brew time
  // (used by the New Session page's recipe preview).
  public static async getAllRecipesWithSteps(deviceType?: string) {
    return await prisma.recipe.findMany({
      where: {
        deletedAt: null,
        ...(deviceType && { deviceType }),
      },
      orderBy: { createdAt: 'desc' },
      include: { steps: true },
    });
  }

  public static async getRecipe(id: number) {
    return await prisma.recipe.findFirst({
      where: { id, deletedAt: null },
      include: {
        steps: { orderBy: { id: 'asc' } },
        ingredients: { orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }] },
      },
    });
  }

  public static async createRecipe(data: CreateRecipeInput) {
    const { steps, ingredients, ...recipeData } = data;

    return await prisma.recipe.create({
      data: {
        ...recipeData,
        steps: {
          create: steps.map((step) => ({
            ...step,
          })),
        },
        ingredients: {
          create: ingredients.map((row, index) => ({ ...row, sortOrder: row.sortOrder ?? index })),
        },
      },
      include: { steps: true, ingredients: true },
    });
  }

  public static async updateRecipe(id: number, data: CreateRecipeInput) {
    const { steps, ingredients, ...recipeData } = data;

    // Delete existing steps/ingredients and create new ones (simpler than diffing)
    await prisma.recipeStep.deleteMany({ where: { recipeId: id } });
    await prisma.recipeIngredient.deleteMany({ where: { recipeId: id } });

    return await prisma.recipe.update({
      where: { id },
      data: {
        ...recipeData,
        steps: {
          create: steps.map((step) => ({ ...step })),
        },
        ingredients: {
          create: ingredients.map((row, index) => ({ ...row, sortOrder: row.sortOrder ?? index })),
        },
      },
      include: { steps: true, ingredients: true },
    });
  }

  public static async deleteRecipe(id: number) {
    return await prisma.recipe.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  public static async duplicateRecipe(id: number) {
    const original = await prisma.recipe.findFirst({
      where: { id, deletedAt: null },
      include: { steps: true, ingredients: true },
    });

    if (!original) {
      throw new Error(`Recipe ${id} not found`);
    }

    const { steps, ingredients } = original;

    return await prisma.recipe.create({
      data: {
        ...omit(original, ['id', 'createdAt', 'updatedAt', 'deletedAt', 'steps', 'ingredients']),
        name: `${original.name} (Copy)`,
        steps: {
          create: steps.map(({ id: _stepId, recipeId: _recipeId, ...step }) => ({ ...step })),
        },
        ingredients: {
          create: ingredients.map(({ id: _ingId, recipeId: _ingRecipeId, ...ingredient }) => ({ ...ingredient })),
        },
      },
      include: { steps: true, ingredients: true },
    });
  }

  // Generate default OLED image bitmap (1024 bytes hex string for 128x64 OLED)
  public static getDefaultImage(): string {
    // Empty/black image - all zeros
    return '0'.repeat(1024);
  }

  // Validate Pico recipe constraints (shared implementation, safe to use from client code too)
  public static validatePicoRecipe(steps: RecipeStep[]): { valid: boolean; errors: string[] } {
    return validatePicoRecipe(steps);
  }
}
