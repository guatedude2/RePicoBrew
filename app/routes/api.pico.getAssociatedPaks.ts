import type { LoaderFunctionArgs } from 'react-router';
import { picoResponse } from '~/utils/pico-response.server';
import { z } from 'zod';
import { DeviceRepository } from '~/repositories/device.server';
import { RecipeRepository } from '~/repositories/recipe.server';
import { SessionRepository } from '~/repositories/session.server';
import { generatePakId } from '~/utils/pak';
import { DEVICE_RECIPE_LIST_LIMIT } from '~/utils/queued-brew';

const bodyValidator = z.object({
  uid: z.string(),
});

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const body = bodyValidator.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!body.success) {
    throw new Response(`Action payload error: ${JSON.stringify(body.error.flatten().fieldErrors)}`, { status: 400 });
  }

  // get device if it exists
  const device = await DeviceRepository.getDeviceByUID(body.data.uid);
  if (!device) {
    return picoResponse(`##\r\n`);
  }
  await DeviceRepository.touchLastSeen(device.id);

  // A brew queued from the app's New Session page: the device sees only that recipe (under the pak id
  // the queued session was created with), and picking it continues that session instead of making a
  // duplicate — see app/services/queued-brew.server.ts.
  const queued = await SessionRepository.findQueuedBrew(device.id);
  let entries: Array<{ pakId: string; name: string }>;
  if (queued?.recipe) {
    entries = [{ pakId: queued.uid, name: queued.recipe.name }];
  } else {
    // Nothing queued (brewing started on the device alone): a capped list for this device's own
    // recipe type, falling back to all recipes if it has none — the reply is unpaginated, so it can't
    // be allowed to grow with the whole library.
    let recipes = await RecipeRepository.getAllRecipes(device.deviceType);
    if (recipes.length === 0) {
      recipes = await RecipeRepository.getAllRecipes();
    }
    entries = recipes.slice(0, DEVICE_RECIPE_LIST_LIMIT).map(({ id, name }) => ({
      pakId: generatePakId(device.id, id, device.sessionCount + 1),
      name,
    }));
  }
  return picoResponse(`#${entries.map(({ pakId, name }) => `${pakId},${name}|`)}#\r\n`);
};
