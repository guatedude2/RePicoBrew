import type { ActionArgs, LoaderArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { DeviceRepository } from '~/repositories/device.server';
import { DeviceType } from '~/types';

export const meta = () => [
  { title: 'Settings | RePicoBrew' },
  { name: 'description', content: 'Manage your settings' },
];

export const loader = async (_args: LoaderArgs) => {
  const devices = await DeviceRepository.listDevices();
  return json({ devices });
};

export const action = async ({ request }: ActionArgs) => {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'approve-device') {
    const uid = formData.get('uid') as string;
    const name = formData.get('name') as string;
    if (!uid || !name) {
      return json({ error: 'Missing uid or name' }, { status: 400 });
    }

    // Check if device already exists
    const existing = await DeviceRepository.getDeviceByUID(uid);
    if (existing) {
      return json({ error: 'Device already exists' }, { status: 400 });
    }

    await DeviceRepository.createDevice(uid, name, DeviceType.PICOBREW_C);
    return json({ success: true });
  }

  return json({ error: 'Unknown intent' }, { status: 400 });
};

export { Settings as default } from '~/pages/Settings';
