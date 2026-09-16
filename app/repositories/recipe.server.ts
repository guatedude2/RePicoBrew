import prisma from '~/services/prisma.server';

export enum PicoLocationMap {
  Prime = 0,
  Mash = 1,
  PassThru = 2,
  Adjunct1 = 3,
  Adjunct2 = 4,
  Adjunct3 = 6,
  Adjunct4 = 5,
}

export type RecipeStep = {
  name: string;
  temperature: number;
  stepTime: number;
  drainTime: number;
  location: number;
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

  public static async getRecipe(id: number) {
    return await prisma.recipe.findFirst({
      where: { id, deletedAt: null },
      include: { steps: { orderBy: { id: 'asc' } } },
    });
  }

  public static async createRecipe(data: CreateRecipeInput) {
    const { steps, ...recipeData } = data;

    return await prisma.recipe.create({
      data: {
        ...recipeData,
        steps: {
          create: steps.map((step) => ({
            ...step,
          })),
        },
      },
      include: { steps: true },
    });
  }

  public static async updateRecipe(id: number, data: CreateRecipeInput) {
    const { steps, ...recipeData } = data;

    // Delete existing steps and create new ones (simpler than diffing)
    await prisma.recipeStep.deleteMany({ where: { recipeId: id } });

    return await prisma.recipe.update({
      where: { id },
      data: {
        ...recipeData,
        steps: {
          create: steps.map((step) => ({ ...step })),
        },
      },
      include: { steps: true },
    });
  }

  public static async deleteRecipe(id: number) {
    return await prisma.recipe.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // Generate default OLED image bitmap (1024 bytes hex string for 128x64 OLED)
  public static getDefaultImage(): string {
    // Empty/black image - all zeros
    return '0'.repeat(1024);
  }

  // Validate Pico recipe constraints
  public static validatePicoRecipe(steps: RecipeStep[]): { valid: boolean; errors: string[] } {
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
}
