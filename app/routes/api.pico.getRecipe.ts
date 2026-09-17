import type { LoaderArgs } from '@remix-run/node';
import { z } from 'zod';
import { BatchRepository } from '~/repositories/batch.server';
import { DeviceRepository } from '~/repositories/device.server';
import { PicoLocationMap, RecipeRepository } from '~/repositories/recipe.server';
import { SessionRepository } from '~/repositories/session.server';
import { SessionState, SessionType, DeviceLogType, DeviceState } from '~/types';
import pubSub from '~/services/pubsub.server';
import { getPakIdData } from '~/utils/pak';

const DEFAULT_IMAGE =
  '0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003f00000000000007f8ffc00000070000ff9fe0000007fffffc7fc00000070000ffcfe0000007fffffe7f800000070000ffcfe0000007fe7fff3f800000070000ffefc7fffe0ffc7fff3f87f00fc70000f7e7c3fffe0ffc7e3f3f87f3cfc70000f3e7c3f7fe0ffc7e1fbf87e3e7c70000f1f7c3e3fe0ffc3e1f9f87e7e7c70000f1f7c3e3fe0ffc3e0f9f87c7e7c70000f1f7c1e3ff0ffc3e0f9f8fc7e7c70000f0f7c1e3ff0ffc3e0f9f0fc7e7c70000f0f7c1e3ff0ffc3e0f9f0f83e7c70000f0f7c1e3ff0ffc3e0f9f0f81c7c30000f0f7c1e3ff0efc3e0f9f0f0007e30000f0f7c1e3ff0efc3e0f9f0f0007e30000f0f781e3ff1efc3e0f9f1f07e7e30000f0f781e3ef1efc3e1f9f1e07e7e30000f1f781e3ef1cfc3e1f9f1e03e7e30000f1f781e3ef1cfc3e1f9f3e03e7630000e1f781e1ef9cfc3e1f9f3c03e7730000e1f781e1ef9cfc3e3f9f7c03e7770000e1f781e1e79cfc3e7f1ffc03e7770000e3f781e1e7bcfc3eff1ffc03c7370000e3e781e3e7bcfc3fff1ffe03c7370000ffe781e3e7b8fc3ffe1fff83c73f0000ffe781e3e7b8fc3ffe1fff83c73f0000ffc7c1e3e7f8fc3ff81fffc3c73f0000ffc7c1e3e7f8fc3ff01fffc3c73f0000ff87c1e3e3f8fc3e001f0fc3c71f0000ff07c1e3e3f8fc3e001f0fc3c71f0000f007c1e3e3f8fc3e001f07c3c71f0000f007c1e3e3f8fc3e001f07c3c71f0000f007c1e3e3f8fc3e001f07c3c71f0000f007c1e3e3f8fc3e001f07c3c71f0000f007c3e3e3f0fc3e001f07e3c71f0000f007c3e3e3f0fc3e001f87e3c70f0000f003e3e3e3f0fc3e001f87e3c70f0000f003ffe3e3f0fc7f001f87e3c70f0000f003ffc3e3f0fc7f001f87e3c70f0000f003ffc7e000fc7f001f87e3c78f0000f001ff87f001fcff003f87f3e78f0000f800ff87f001fe00003fc3f7ef87000000003e000001fe00003fc3e780000000000000000003fe00000001c0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';

const bodyValidator = z.object({
  uid: z.string(),
  rfid: z.string(),
  ibu: z.preprocess((value) => Number.parseInt(`${value || '-1'}`), z.number()),
  abv: z.preprocess((value) => Number.parseInt(`${value || '-1'}`), z.number()),
});

///#NAME/IBU_TWEAK,ABV_TWEAK,ABV,IBU,[TEMPERATURE,STEP_TIME,DRAIN_TIME,LOCATION,STEP_NAME]+,|128x64 1024 byte OLED Image|#

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

  // decode the pak id
  const { recipeId } = getPakIdData(body.data.rfid);
  if (recipeId === null) {
    return new Response(`##\r\n`);
  }

  // get recipe
  const recipe = await RecipeRepository.getRecipe(recipeId);
  if (!recipe) {
    return new Response(`##\r\n`);
  }

  const session = await SessionRepository.getSession(body.data.rfid);
  if (session) {
    // update the status if the session exists
    await SessionRepository.updateSessionState(session.id, SessionType.BREWING, SessionState.READY, 'Ready to Brew');
  } else {
    // create a session, and a batch to carry it through brew -> ferment -> carbonate -> done
    const newSession = await SessionRepository.createSession(body.data.rfid, SessionType.BREWING, device.id, recipe.id);
    const batch = await BatchRepository.createBatch(recipe.name, recipe.id);
    await BatchRepository.attachSession(batch.id, newSession.id);

    // record the session creation on the device
    await DeviceRepository.updateDeviceSessionCount(device.id, device.sessionCount + 1);

    // log device session creation event
    await DeviceRepository.createDeviceLog(device.id, {
      type: DeviceLogType.SESSION_CREATED,
      sesType: SessionType.BREWING,
    });
  }

  const recipeHeader = `${recipe.name}/${body.data.ibu},${body.data.abv},${recipe.abv},${recipe.ibu}`;
  const recipeImage = `|${recipe.image ?? DEFAULT_IMAGE}|`;

  pubSub.publish('device-state-update', { uid: body.data.uid, state: DeviceState.BREWING });

  return new Response(
    `#${recipeHeader},${recipe.steps.map(
      ({ temperature, stepTime, drainTime, location, name }) =>
        `${temperature},${stepTime},${drainTime},${
          PicoLocationMap[location as unknown as keyof typeof PicoLocationMap]
        },${name}`,
    )},${recipeImage}#\r\n`,
  );
};
