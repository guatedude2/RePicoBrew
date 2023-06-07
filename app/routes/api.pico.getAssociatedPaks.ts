import type { LoaderArgs } from '@remix-run/node';
import { z } from 'zod';
import { DeviceRepository } from '~/repositories/device.server';
import { RecipeRepository } from '~/repositories/recipe.server';
import { generatePakId } from '~/utils/pak';

const bodyValidator = z.object({
  uid: z.string(),
});

export const loader = async ({ request }: LoaderArgs) => {
  const body = bodyValidator.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!body.success) {
    throw new Response(`Action payload error: ${JSON.stringify(body.error.flatten().fieldErrors)}`, { status: 400 });
  }

  // get device if it exists
  const device = await DeviceRepository.getDeviceByUID(body.data.uid);
  if (!device) {
    return new Response(`##\r\n`);
  }

  const recipes = await RecipeRepository.getAllRecipes();
  return new Response(
    `#${recipes.map(({ id, name }) => `${generatePakId(device.id, id, device.sessionCount + 1)},${name}|`)}#\r\n`,
  );
};
