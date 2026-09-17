import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { useLoaderData } from 'react-router';
import { RecipeEditor, type RecipeEditorData } from '~/pages/RecipeEditor';
import { RecipeRepository, type CreateRecipeInput } from '~/repositories/recipe.server';
import { parseRecipeFormData } from '~/utils/recipe-photo.server';

export const meta = ({ data }: { data?: { readOnly: boolean } }) => [
  { title: `${data?.readOnly ? 'View' : 'Edit'} Recipe | RePicoBrew` },
];

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const idParam = params.id;
  if (!idParam) {
    throw new Response('Recipe not found', { status: 404 });
  }
  const id = parseInt(idParam, 10);
  const recipe = await RecipeRepository.getRecipe(id);

  if (!recipe) {
    throw new Response('Recipe not found', { status: 404 });
  }

  const readOnly = new URL(request.url).searchParams.get('mode') === 'view';

  return { recipe, readOnly };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const idParam = params.id;
  if (!idParam) {
    throw new Response('Recipe not found', { status: 404 });
  }
  const id = parseInt(idParam, 10);
  const existing = await RecipeRepository.getRecipe(id);
  if (!existing) {
    throw new Response('Recipe not found', { status: 404 });
  }

  const { data, photoUrl } = await parseRecipeFormData(request);

  const input: CreateRecipeInput = {
    ...data,
    image: existing.image,
    photoUrl: photoUrl ?? existing.photoUrl,
  };

  await RecipeRepository.updateRecipe(id, input);
  return redirect('/recipes');
};

export default function RecipeEditPage() {
  const { recipe, readOnly } = useLoaderData<typeof loader>();
  return (
    <RecipeEditor recipe={recipe as unknown as RecipeEditorData} deviceType={recipe.deviceType} readOnly={readOnly} />
  );
}
