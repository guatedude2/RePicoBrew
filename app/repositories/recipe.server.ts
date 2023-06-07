import prisma from '~/services/prisma.server';

export enum PicoLocationMap {
  'Prime' = 0,
  'Mash' = 1,
  'PassThru' = 2,
  'Adjunct1' = 3,
  'Adjunct2' = 4,
  'Adjunct3' = 6,
  'Adjunct4' = 5,
}

export class RecipeRepository {
  public static async getAllRecipes() {
    return await prisma.recipe.findMany();
  }

  public static async getRecipe(id: number) {
    return await prisma.recipe.findFirst({ where: { id }, include: { steps: true } });
  }
}
