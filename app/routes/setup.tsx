import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { data, redirect } from 'react-router';
import { z } from 'zod';
import { ConfigRepository } from '~/repositories/config.server';
import { DeviceRepository } from '~/repositories/device.server';
import { UserRepository } from '~/repositories/user.server';
import { authenticateUser, isAuthenticated, sessionKey } from '~/services/auth.server';
import { sessionStorage } from '~/services/session.server';
import type { DeviceType } from '~/types';
import { applyAccessPoint, applyHostname, applyWifi } from '~/utils/network-control.server';
import { isRaspberryPi } from '~/utils/platform.server';
import { serializeDates } from '~/utils/serialize.server';
import { checkInternetConnectivity } from '~/utils/wifi.server';

export const meta = () => [{ title: 'First-Time Setup | RePicoBrew' }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Once an account exists, setup is done — don't let this wizard be replayed.
  if ((await UserRepository.count()) > 0) {
    const session = await isAuthenticated(request);
    throw redirect(session ? '/' : '/signin');
  }

  const [devices, discoveredDevices] = await Promise.all([
    DeviceRepository.listDevices(),
    DeviceRepository.listDiscoveredDevices(),
  ]);

  return serializeDates({
    devices: devices.map((device) => ({ ...device, online: DeviceRepository.isDeviceOnline(device) })),
    discoveredDevices,
    isRpi: isRaspberryPi(),
  });
};

const setupSchema = z
  .object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string(),
    hostname: z.string().min(1),
    apName: z.string().min(1),
    apPassword: z.string().min(1),
    wifiName: z.string().min(1),
    wifiPassword: z.string().min(1),
  })
  .refine((body) => body.password === body.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export const action = async ({ request }: ActionFunctionArgs) => {
  // Defensive: this route has no auth gate (there's no account yet), so re-check the precondition
  // on every write instead of trusting the loader ran first.
  if ((await UserRepository.count()) > 0) {
    return data({ error: 'Setup has already been completed.' }, { status: 400 });
  }

  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'pair-device') {
    const uid = formData.get('uid') as string;
    const name = formData.get('name') as string;
    const deviceType = formData.get('deviceType') as DeviceType;
    const modelIcon = formData.get('modelIcon') as string;
    const color = (formData.get('color') as string) || undefined;
    if (!uid || !name || !deviceType) {
      return data({ error: 'Missing uid, name, or device type' }, { status: 400 });
    }
    const existing = await DeviceRepository.getDeviceByUID(uid);
    if (existing) {
      return data({ error: 'Product ID already configured' }, { status: 400 });
    }
    await DeviceRepository.claimDevice(uid, name, deviceType, { color, metadata: { modelIcon } });
    return { success: true };
  }

  if (intent === 'dismiss-discovered-device') {
    const uid = formData.get('uid') as string;
    if (!uid) {
      return data({ error: 'Missing uid' }, { status: 400 });
    }
    await DeviceRepository.dismissDiscoveredDevice(uid);
    return { success: true };
  }

  if (intent === 'delete-device') {
    const id = parseInt(formData.get('id') as string, 10);
    if (!id) {
      return data({ error: 'Missing device id' }, { status: 400 });
    }
    await DeviceRepository.deleteDevice(id);
    return { success: true };
  }

  if (intent === 'apply-wifi') {
    const ssid = (formData.get('ssid') as string)?.trim();
    const password = (formData.get('password') as string)?.trim();
    if (!ssid || !password) {
      return data({ error: 'Missing Wi-Fi network name or password' }, { status: 400 });
    }
    if (!isRaspberryPi()) {
      // Dev machine: nothing to actually join, so let the wizard proceed unblocked — matches the
      // RpiOnlyHint copy already shown for this step.
      return { success: true, connected: true };
    }
    const result = await applyWifi(ssid, password);
    if (!result.success) {
      return data({ error: `Could not join that network: ${result.error}` }, { status: 400 });
    }
    const connected = await checkInternetConnectivity();
    if (!connected) {
      // apply-wifi.sh's own success just means the config was written and dhcpcd restarted — a
      // wrong password fails association asynchronously in the driver, not as a script error, so
      // this is also how a bad password surfaces: no route ever comes up, and the check times out.
      return data(
        { error: 'Could not reach the internet on that network — check the password and try again.' },
        { status: 400 },
      );
    }
    return { success: true, connected: true };
  }

  if (intent === 'complete-setup') {
    const body = setupSchema.safeParse(Object.fromEntries(formData));
    if (!body.success) {
      return data({ error: body.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
    }
    const { name, email, password, hostname, apName, apPassword, wifiName, wifiPassword } = body.data;

    const existing = await UserRepository.findUserByEmail(email);
    if (existing) {
      return data({ error: 'A user with that email already exists' }, { status: 400 });
    }

    await UserRepository.createUser({ name, email, password });
    await Promise.all([
      ConfigRepository.setConfig('SERVER_HOSTNAME', hostname),
      ConfigRepository.setConfig('ACCESS_POINT', { name: apName, password: apPassword }),
      ConfigRepository.setConfig('WIFI', { name: wifiName, password: wifiPassword }),
    ]);

    // Wi-Fi was already applied and internet-verified by the 'apply-wifi' intent when the user
    // left that wizard step — re-joining here would just be a second, redundant restart+wait.
    // Hostname/AP have no equivalent live-validation step, so apply them now, best-effort: a
    // failure here (e.g. a non-Pi dev machine, or a stale sudoers rule) shouldn't block finishing
    // setup, since the admin account and Wi-Fi — the two things that actually matter for a usable
    // device — are already in place.
    if (isRaspberryPi()) {
      await applyHostname(hostname);
      await applyAccessPoint(apName, apPassword);
    }

    // Sign the new admin straight in so "Go to Dashboard" doesn't dead-end at another sign-in form.
    const session = await authenticateUser(email, password);
    const cookieHeader = request.headers.get('cookie');
    const cookieSession = await sessionStorage.getSession(cookieHeader);
    cookieSession.set(sessionKey, session);
    const headers = new Headers({ 'Set-Cookie': await sessionStorage.commitSession(cookieSession) });

    return data({ success: true }, { headers });
  }

  return data({ error: 'Unknown intent' }, { status: 400 });
};

export { Setup as default } from '~/pages/Setup';
