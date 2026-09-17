import type { ActionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { UserRepository } from '~/repositories/user.server';
import authenticator from '~/services/auth.server';

export const meta = () => [{ title: 'My Profile | RePicoBrew' }];

export const action = async ({ request }: ActionArgs) => {
  const session = await authenticator.isAuthenticated(request);
  if (!session || session instanceof Error) {
    return json({ error: 'Not authenticated' }, { status: 401 });
  }

  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'changePassword') {
    const currentPassword = formData.get('currentPassword') as string;
    const newPassword = formData.get('newPassword') as string;
    if (!currentPassword || !newPassword) {
      return json({ error: 'Missing current or new password' }, { status: 400 });
    }

    const user = await UserRepository.findUserByEmail(session.email);
    if (!user) {
      return json({ error: 'User not found' }, { status: 404 });
    }

    const updated = await UserRepository.changePassword(user.id, currentPassword, newPassword);
    if (!updated) {
      return json({ error: 'Current password is incorrect' }, { status: 400 });
    }
    return json({ success: true });
  }

  return json({ error: 'Unknown intent' }, { status: 400 });
};

export { Profile as default } from '~/pages/Profile';
