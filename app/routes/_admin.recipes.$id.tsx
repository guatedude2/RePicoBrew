import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { useLoaderData } from 'react-router';
import { RecipeEditor, type RecipeEditorData } from '~/pages/RecipeEditor';
import { PicoPackEditor, type PicoPackEditorData } from '~/pages/RecipeEditor/PicoPackEditor';
import { RecipeRepository, type CreateRecipeInput } from '~/repositories/recipe.server';
import { RecipePackType } from '~/types';
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

  // Recipes open read-only; editing is an explicit `?mode=edit` (the editors' Edit Recipe button).
  const readOnly = new URL(request.url).searchParams.get('mode') !== 'edit';

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
  return redirect(`/recipes/${id}?mode=view`);
};

export default function RecipeEditPage() {
  const { recipe, readOnly } = useLoaderData<typeof loader>();
  // Remount after a save or a view/edit switch so the editors' initial state (and their unsaved-changes
  // baseline) is rebuilt from the freshly loaded recipe instead of the previous edit session.
  const editorKey = `${recipe.id}-${recipe.updatedAt}-${readOnly}`;
  if (recipe.packType === RecipePackType.PICOPACK) {
    return (
      <PicoPackEditor
        key={editorKey}
        recipe={recipe as unknown as PicoPackEditorData}
        deviceType={recipe.deviceType}
        readOnly={readOnly}
      />
    );
  }
  return (
    <RecipeEditor
      key={editorKey}
      recipe={recipe as unknown as RecipeEditorData}
      deviceType={recipe.deviceType}
      readOnly={readOnly}
    />
  );
}
