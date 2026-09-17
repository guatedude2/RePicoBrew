import type { ActionFunctionArgs } from 'react-router';
import { data } from 'react-router';
import { UserRepository } from '~/repositories/user.server';
import authenticator from '~/services/auth.server';

export const meta = () => [{ title: 'My Profile | RePicoBrew' }];

export const action = async ({ request }: ActionFunctionArgs) => {
  const session = await authenticator.isAuthenticated(request);
  if (!session) {
    return data({ error: 'Not authenticated' }, { status: 401 });
  }

  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'changePassword') {
    const currentPassword = formData.get('currentPassword') as string;
    const newPassword = formData.get('newPassword') as string;
    if (!currentPassword || !newPassword) {
      return data({ error: 'Missing current or new password' }, { status: 400 });
    }

    const user = await UserRepository.findUserByEmail(session.email);
    if (!user) {
      return data({ error: 'User not found' }, { status: 404 });
    }

    const updated = await UserRepository.changePassword(user.id, currentPassword, newPassword);
    if (!updated) {
      return data({ error: 'Current password is incorrect' }, { status: 400 });
    }
    return { success: true };
  }

  return data({ error: 'Unknown intent' }, { status: 400 });
};

export { Profile as default } from '~/pages/Profile';
