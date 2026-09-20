import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { data, redirect } from 'react-router';
import { useLoaderData } from 'react-router';
import { BatchRepository } from '~/repositories/batch.server';
import { DeviceRepository } from '~/repositories/device.server';
import { RecipeRepository } from '~/repositories/recipe.server';
import { SessionRepository } from '~/repositories/session.server';
import { cancelQueuedBrew, queueBrew } from '~/services/queued-brew.server';
import { DeviceLogType, DeviceState, DeviceType, SessionType } from '~/types';
import pubSub from '~/services/pubsub.server';
import { NewSession } from '~/pages/NewSession';

export const meta = () => [{ title: 'New Session | RePicoBrew' }];

export const loader = async (_args: LoaderFunctionArgs) => {
  const [recipes, devices] = await Promise.all([
    RecipeRepository.getAllRecipesWithSteps(),
    DeviceRepository.listDevices(),
  ]);
  const brewDevices = devices.filter((d) => d.deviceType !== DeviceType.TILT);
  const tiltDevices = devices.filter((d) => d.deviceType === DeviceType.TILT);
  return {
    recipes,
    // `online` is computed here (it needs the server's clock and the device's last check-in); the
    // page shows it on each device tile.
    brewDevices: brewDevices.map((device) => ({ ...device, online: DeviceRepository.isDeviceOnline(device) })),
    tiltDevices,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const intent = formData.get('intent');

  // Pico flow: queue the brew for the device to pick up (see app/services/queued-brew.server.ts).
  if (intent === 'queueBrew') {
    const fermentDeviceIdRaw = formData.get('fermentDeviceId');
    const carbMethod = String(formData.get('carbMethod') || 'Bottle');
    const result = await queueBrew({
      deviceId: Number(formData.get('deviceId')),
      recipeId: Number(formData.get('recipeId')),
      fermentDeviceId: fermentDeviceIdRaw ? Number(fermentDeviceIdRaw) : null,
      carbMethod,
      carbUnit: carbMethod === 'Forced (CO2)' ? 'hours' : 'weeks',
      carbDuration: Number(formData.get('carbDuration') || 2),
    });
    if (!result.ok) {
      return data({ error: result.error }, { status: result.status });
    }
    return { queuedSessionId: result.sessionId, recipeName: result.recipeName };
  }

  if (intent === 'cancelQueuedBrew') {
    const result = await cancelQueuedBrew(Number(formData.get('sessionId')));
    if (!result.ok) {
      return data({ error: result.error }, { status: 409 });
    }
    return { cancelled: true };
  }

  const recipeId = Number(formData.get('recipeId'));
  const deviceId = Number(formData.get('deviceId'));
  const fermentDeviceIdRaw = formData.get('fermentDeviceId');
  const fermentDeviceId = fermentDeviceIdRaw ? Number(fermentDeviceIdRaw) : null;
  const carbMethod = String(formData.get('carbMethod') || 'Bottle');
  const carbDuration = Number(formData.get('carbDuration') || 2);
  const carbUnit = carbMethod === 'Forced (CO2)' ? 'hours' : 'weeks';

  if (!recipeId || !deviceId) {
    return data({ error: 'Recipe and brew device are required' }, { status: 400 });
  }

  const device = await DeviceRepository.getDeviceById(deviceId);
  if (!device) {
    return data({ error: 'Device not found' }, { status: 404 });
  }
  if (device.deviceType === DeviceType.TILT) {
    return data({ error: 'Select a brewing device, not a Tilt hydrometer' }, { status: 400 });
  }

  const recipe = await RecipeRepository.getRecipe(recipeId);
  if (!recipe) {
    return data({ error: 'Recipe not found' }, { status: 404 });
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
