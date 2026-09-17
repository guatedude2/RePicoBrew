import type { ActionFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { PicoPackEditor } from '~/pages/RecipeEditor/PicoPackEditor';
import { RecipeRepository, type CreateRecipeInput } from '~/repositories/recipe.server';
import { DeviceType } from '~/types';
import { parseRecipeFormData } from '~/utils/recipe-photo.server';

export const meta = () => [{ title: 'New PicoPack Recipe | RePicoBrew' }];

export const action = async ({ request }: ActionFunctionArgs) => {
  const { data, photoUrl } = await parseRecipeFormData(request);

  const input: CreateRecipeInput = {
    ...data,
    image: RecipeRepository.getDefaultImage(),
    photoUrl,
  };

  await RecipeRepository.createRecipe(input);
  return redirect('/recipes');
};

export default function RecipeNewPicoPackPage() {
  return <PicoPackEditor deviceType={DeviceType.PICOBREW_C} />;
}
