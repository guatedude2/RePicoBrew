import type { ActionArgs, LoaderArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { BatchRepository } from '~/repositories/batch.server';
import { DeviceRepository } from '~/repositories/device.server';
import { RecipeRepository } from '~/repositories/recipe.server';
import { SessionRepository } from '~/repositories/session.server';
import { DeviceLogType, DeviceState, DeviceType, SessionType } from '~/types';
import pubSub from '~/services/pubsub.server';
import { NewSession } from '~/pages/NewSession';

export const meta = () => [{ title: 'New Session | RePicoBrew' }];

export const loader = async (_args: LoaderArgs) => {
  const [recipes, devices] = await Promise.all([
    RecipeRepository.getAllRecipesWithSteps(),
    DeviceRepository.listDevices(),
  ]);
  const brewDevices = devices.filter((d) => d.deviceType !== DeviceType.TILT);
  const tiltDevices = devices.filter((d) => d.deviceType === DeviceType.TILT);
  return json({ recipes, brewDevices, tiltDevices });
};

export const action = async ({ request }: ActionArgs) => {
  const formData = await request.formData();
  const recipeId = Number(formData.get('recipeId'));
  const deviceId = Number(formData.get('deviceId'));
  const fermentDeviceIdRaw = formData.get('fermentDeviceId');
  const fermentDeviceId = fermentDeviceIdRaw ? Number(fermentDeviceIdRaw) : null;
  const carbMethod = String(formData.get('carbMethod') || 'Bottle');
  const carbDuration = Number(formData.get('carbDuration') || 2);
  const carbUnit = carbMethod === 'Forced (CO2)' ? 'hours' : 'weeks';

  if (!recipeId || !deviceId) {
    return json({ error: 'Recipe and brew device are required' }, { status: 400 });
  }

  const device = await DeviceRepository.getDeviceById(deviceId);
  if (!device) {
    return json({ error: 'Device not found' }, { status: 404 });
  }
  if (device.deviceType === DeviceType.TILT) {
    return json({ error: 'Select a brewing device, not a Tilt hydrometer' }, { status: 400 });
  }

  const recipe = await RecipeRepository.getRecipe(recipeId);
  if (!recipe) {
    return json({ error: 'Recipe not found' }, { status: 404 });
  }

  const uid = `MANUAL-${Date.now()}-${device.uid}`;
  const session = await SessionRepository.createSession(uid, SessionType.MANUAL_BREW, device.id, recipe.id);
  const batch = await BatchRepository.createBatch(recipe.name, recipe.id, {
    fermentDeviceId,
    carbMethod,
    carbUnit,
    carbDuration,
  });
  await BatchRepository.attachSession(batch.id, session.id);

  await DeviceRepository.updateDeviceSessionCount(device.id, device.sessionCount + 1);
  await DeviceRepository.updateDeviceState(device.id, DeviceState.BREWING);
  await DeviceRepository.createDeviceLog(device.id, {
    type: DeviceLogType.SESSION_CREATED,
    sesType: SessionType.MANUAL_BREW,
  });

  pubSub.publish('device-state-update', { uid: device.uid, state: DeviceState.BREWING });

  return redirect(`/sessions/${session.id}`);
};

export default function NewSessionRoute() {
  const { recipes, brewDevices, tiltDevices } = useLoaderData<typeof loader>();
  return <NewSession recipes={recipes} brewDevices={brewDevices} tiltDevices={tiltDevices} />;
}
