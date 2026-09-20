import type { LoaderFunctionArgs } from 'react-router';
import { data } from 'react-router';
import { UserRepository } from '~/repositories/user.server';
import { isAuthenticated } from '~/services/auth.server';
import { listNearbyNetworks } from '~/utils/wifi.server';

// A scan takes several seconds on a Pi Zero W, so pages fetch it after they've rendered (see
// WifiNetworkPicker) instead of blocking their own loaders on it. Open while first-time setup is
// still in progress (no account exists yet, so there is nobody to sign in as); signed-in users only
// afterwards.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const setupInProgress = (await UserRepository.count()) === 0;
  if (!setupInProgress && !(await isAuthenticated(request))) {
    return data({ error: 'Not authenticated' }, { status: 401 });
  }
  return { networks: await listNearbyNetworks() };
};
