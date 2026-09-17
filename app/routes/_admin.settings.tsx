import type { ActionArgs, LoaderArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { DeviceRepository } from '~/repositories/device.server';
import { UserRepository } from '~/repositories/user.server';
import { DeviceType } from '~/types';

export const meta = () => [
  { title: 'Settings | RePicoBrew' },
  { name: 'description', content: 'Manage your settings' },
];

export const loader = async (_args: LoaderArgs) => {
  const [devices, users] = await Promise.all([DeviceRepository.listDevices(), UserRepository.listUsers()]);
  return json({ devices, users });
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

  if (intent === 'addUser') {
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const role = (formData.get('role') as string) || 'Regular';
    if (!name || !email || !password) {
      return json({ error: 'Missing name, email, or password' }, { status: 400 });
    }
    const existing = await UserRepository.findUserByEmail(email);
    if (existing) {
      return json({ error: 'A user with that email already exists' }, { status: 400 });
    }
    await UserRepository.createUser({ name, email, password, role });
    return json({ success: true });
  }

  if (intent === 'updateUserRole') {
    const id = parseInt(formData.get('id') as string);
    const role = formData.get('role') as string;
    if (!id || !role) {
      return json({ error: 'Missing id or role' }, { status: 400 });
    }
    await UserRepository.updateUserRole(id, role);
    return json({ success: true });
  }

  if (intent === 'deleteUser') {
    const id = parseInt(formData.get('id') as string);
    const users = await UserRepository.listUsers();
    if (users.length <= 1) {
      return json({ error: 'At least one user must remain' }, { status: 400 });
    }
    await UserRepository.deleteUser(id);
    return json({ success: true });
  }

  return json({ error: 'Unknown intent' }, { status: 400 });
};

export { Settings as default } from '~/pages/Settings';
