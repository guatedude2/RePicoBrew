import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { data } from 'react-router';
import { AiSettingsRepository } from '~/repositories/ai-settings.server';
import { ConfigRepository } from '~/repositories/config.server';
import { DeviceRepository } from '~/repositories/device.server';
import { UserRepository } from '~/repositories/user.server';
import {
  listChatCompletionsModels,
  listClaudeModels,
  listOpenAiModels,
  verifyChatCompletionsAccess,
} from '~/services/ai-models.server';
import authenticator from '~/services/auth.server';
import type { DeviceType } from '~/types';
import { applyAccessPoint, applyHostname, applyWifi } from '~/utils/network-control.server';
import { isRaspberryPi } from '~/utils/platform.server';
import { serializeDates } from '~/utils/serialize.server';
import {
  checkForUpdates,
  getBluetoothEnabled,
  getUpdateStatus,
  getWifiClientEnabled,
  rebootPi,
  restartServer,
  setBluetoothEnabled,
  setWifiClientEnabled,
  shutdownPi,
  startUpdates,
} from '~/utils/system-control.server';
import { getSystemInfo } from '~/utils/system-info.server';
import { checkInternetConnectivity } from '~/utils/wifi.server';
import { TIME_FORMAT_CONFIG_KEY } from '~/utils/time-format';
import { normalizeSearchUrl, verifySearchUrl } from '~/services/web-search.server';

// Restart Server / Reboot Pi are a genuine local-privilege-escalation surface (they shell out to
// `sudo`, see ~/utils/system-control.server) — restrict them to the same role tier that already
// gates the rest of admin-only capability in this app. There's no dedicated "Admin" role
// (UserRepository/prisma schema only define "Regular" | "ReadOnly"), so "not ReadOnly" is the
// existing stand-in for "trusted/elevated user" — matches how ReadOnly is treated everywhere else
// this app talks about roles (app/components/settings/UsersCard.tsx, app/pages/Profile.tsx).
// Returns an error response to return from the action, or null if the caller may proceed.
const MIN_PASSWORD_LENGTH = 8;

async function requireSystemControlAccess(request: Request) {
  const session = await authenticator.isAuthenticated(request);
  if (!session) {
    return data({ error: 'Not authenticated' }, { status: 401 });
  }
  if (session.role === 'ReadOnly') {
    return data({ error: 'You do not have permission to do that.' }, { status: 403 });
  }
  return null;
}

export const meta = () => [
  { title: 'Settings | RePicoBrew' },
  { name: 'description', content: 'Manage your settings' },
];

type WifiConfig = { name: string; password: string };

export const loader = async (_args: LoaderFunctionArgs) => {
  const [
    devices,
    discoveredDevices,
    users,
    hostname,
    accessPoint,
    wifi,
    openAiSettings,
    claudeSettings,
    zenSettings,
    customSettings,
    activeProvider,
    bluetoothEnabled,
    wifiClientEnabled,
  ] = await Promise.all([
    DeviceRepository.listDevices(),
    DeviceRepository.listDiscoveredDevices(),
    UserRepository.listUsers(),
    ConfigRepository.getConfig<string>('SERVER_HOSTNAME'),
    ConfigRepository.getConfig<WifiConfig>('ACCESS_POINT'),
    ConfigRepository.getConfig<WifiConfig>('WIFI'),
    AiSettingsRepository.getOpenAiSettings(),
    AiSettingsRepository.getClaudeSettings(),
    AiSettingsRepository.getZenSettings(),
    AiSettingsRepository.getCustomSettings(),
    AiSettingsRepository.getActiveProviderName(),
    getBluetoothEnabled(),
    getWifiClientEnabled(),
  ]);
  return serializeDates({
    devices: devices.map((device) => ({ ...device, online: DeviceRepository.isDeviceOnline(device) })),
    discoveredDevices,
    // Never send password hashes or salts to the browser — only what the Users list shows.
    users: users.map(({ password: _password, salt: _salt, ...user }) => user),
    hostname: hostname ?? '',
    accessPoint: accessPoint ?? { name: '', password: '' },
    wifi: wifi ?? { name: '', password: '' },
    isRpi: isRaspberryPi(),
    hasAiKey:
      openAiSettings.configured || claudeSettings.configured || zenSettings.configured || customSettings.configured,
    openAiSettings,
    claudeSettings,
    zenSettings,
    customSettings,
    activeProvider,
    searchUrl: await AiSettingsRepository.getSearchUrl(),
    systemInfo: getSystemInfo(),
    bluetoothEnabled,
    wifiClientEnabled,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  // Every Settings action changes something (devices, users, keys, network, power), so all of them need a
  // logged-in, non-read-only user — the admin layout's middleware covers login, this covers the role.
  const accessDenied = await requireSystemControlAccess(request);
  if (accessDenied) {
    return accessDenied;
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

    // Check if device already exists
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

  if (intent === 'addUser') {
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const role = (formData.get('role') as string) || 'Regular';
    if (!name || !email || !password) {
      return data({ error: 'Missing name, email, or password' }, { status: 400 });
    }
    const existing = await UserRepository.findUserByEmail(email);
    if (existing) {
      return data({ error: 'A user with that email already exists' }, { status: 400 });
    }
    await UserRepository.createUser({ name, email, password, role });
    return { success: true };
  }

  if (intent === 'resetUserPassword') {
    const id = parseInt(formData.get('id') as string);
    const newPassword = (formData.get('newPassword') as string) ?? '';
    if (!id) {
      return data({ error: 'Missing user' }, { status: 400 });
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return data({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }, { status: 400 });
    }
    const updated = await UserRepository.setPassword(id, newPassword);
    if (!updated) {
      return data({ error: 'User not found' }, { status: 404 });
    }
    return { success: true };
  }

  if (intent === 'updateUser') {
    const id = parseInt(formData.get('id') as string);
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const role = formData.get('role') as string;
    if (!id || !name || !email || !role) {
      return data({ error: 'Missing id, name, email, or role' }, { status: 400 });
    }
    const existing = await UserRepository.findUserByEmail(email);
    if (existing && existing.id !== id) {
      return data({ error: 'A user with that email already exists' }, { status: 400 });
    }
    await UserRepository.updateUser(id, { name, email, role });
    return { success: true };
  }

  if (intent === 'saveSearchUrl') {
    let baseUrl: string;
    try {
      baseUrl = normalizeSearchUrl((formData.get('url') as string) ?? '');
    } catch (error) {
      return data(
        {
          error: error instanceof Error && error.message.startsWith('Enter') ? error.message : 'Enter a valid address.',
        },
        { status: 400 },
      );
    }
    try {
      await verifySearchUrl(baseUrl);
    } catch (error) {
      return data(
        { error: error instanceof Error ? error.message : 'Could not verify that address.' },
        { status: 400 },
      );
    }
    await AiSettingsRepository.setSearchUrl(baseUrl);
    return { success: true };
  }

  if (intent === 'clearSearchUrl') {
    await AiSettingsRepository.clearSearchUrl();
    return { success: true };
  }

  if (intent === 'saveTimeFormat') {
    const timeFormat = formData.get('timeFormat');
    if (timeFormat !== '12h' && timeFormat !== '24h') {
      return data({ error: 'Invalid time format' }, { status: 400 });
    }
    await ConfigRepository.setConfig(TIME_FORMAT_CONFIG_KEY, timeFormat);
    return { success: true };
  }

  if (intent === 'saveGeneral') {
    const accessError = await requireSystemControlAccess(request);
    if (accessError) {
      return accessError;
    }
    const hostname = formData.get('hostname') as string;
    if (!hostname) {
      return data({ error: 'Missing hostname' }, { status: 400 });
    }
    if (isRaspberryPi()) {
      const result = await applyHostname(hostname);
      if (!result.success) {
        return data({ error: `Could not apply hostname: ${result.error}` }, { status: 400 });
      }
    }
    await ConfigRepository.setConfig('SERVER_HOSTNAME', hostname);
    return { success: true };
  }

  if (intent === 'saveAccessPoint') {
    const accessError = await requireSystemControlAccess(request);
    if (accessError) {
      return accessError;
    }
    const name = formData.get('name') as string;
    const password = formData.get('password') as string;
    if (!name || !password) {
      return data({ error: 'Missing AP network name or password' }, { status: 400 });
    }
    if (isRaspberryPi()) {
      const result = await applyAccessPoint(name, password);
      if (!result.success) {
        return data({ error: `Could not apply access point settings: ${result.error}` }, { status: 400 });
      }
    }
    await ConfigRepository.setConfig<WifiConfig>('ACCESS_POINT', { name, password });
    return { success: true };
  }

  if (intent === 'saveWifi') {
    const accessError = await requireSystemControlAccess(request);
    if (accessError) {
      return accessError;
    }
    const name = formData.get('name') as string;
    const password = formData.get('password') as string;
    if (!name || !password) {
      return data({ error: 'Missing Wi-Fi network name or password' }, { status: 400 });
    }
    if (isRaspberryPi()) {
      const result = await applyWifi(name, password);
      if (!result.success) {
        return data({ error: `Could not join that network: ${result.error}` }, { status: 400 });
      }
      const connected = await checkInternetConnectivity();
      if (!connected) {
        return data(
          { error: 'Could not reach the internet on that network — check the password and try again.' },
          { status: 400 },
        );
      }
    }
    await ConfigRepository.setConfig<WifiConfig>('WIFI', { name, password });
    return { success: true };
  }

  if (intent === 'saveOpenAiApiKey') {
    const apiKey = (formData.get('apiKey') as string)?.trim();
    const model = (formData.get('model') as string)?.trim();
    if (!apiKey) {
      return data({ error: 'Missing API key' }, { status: 400 });
    }
    try {
      await listOpenAiModels(apiKey);
    } catch {
      return data({ error: 'That API key was rejected — check it and try again.' }, { status: 400 });
    }
    await AiSettingsRepository.setOpenAiApiKey(apiKey, model);
    return { success: true };
  }

  if (intent === 'clearOpenAiApiKey') {
    await AiSettingsRepository.clearOpenAiApiKey();
    return { success: true };
  }

  if (intent === 'listOpenAiModels') {
    const typedKey = (formData.get('apiKey') as string)?.trim();
    const apiKey = typedKey || (await AiSettingsRepository.getOpenAiApiKeyPlain());
    if (!apiKey) {
      return data({ error: 'Enter an API key first' }, { status: 400 });
    }
    try {
      const models = await listOpenAiModels(apiKey);
      return { models };
    } catch {
      return data({ error: 'Could not load models — check the API key.' }, { status: 400 });
    }
  }

  if (intent === 'saveClaudeApiKey') {
    const apiKey = (formData.get('apiKey') as string)?.trim();
    const model = (formData.get('model') as string)?.trim();
    if (!apiKey) {
      return data({ error: 'Missing API key' }, { status: 400 });
    }
    try {
      await listClaudeModels(apiKey);
    } catch {
      return data({ error: 'That API key was rejected — check it and try again.' }, { status: 400 });
    }
    await AiSettingsRepository.setClaudeApiKey(apiKey, model);
    return { success: true };
  }

  if (intent === 'clearClaudeApiKey') {
    await AiSettingsRepository.clearClaudeApiKey();
    return { success: true };
  }

  if (intent === 'listClaudeModels') {
    const typedKey = (formData.get('apiKey') as string)?.trim();
    const apiKey = typedKey || (await AiSettingsRepository.getClaudeApiKeyPlain());
    if (!apiKey) {
      return data({ error: 'Enter an API key first' }, { status: 400 });
    }
    try {
      const models = await listClaudeModels(apiKey);
      return { models };
    } catch {
      return data({ error: 'Could not load models — check the API key.' }, { status: 400 });
    }
  }

  if (intent === 'saveZenSettings') {
    const apiKey = (formData.get('apiKey') as string)?.trim();
    const model = (formData.get('model') as string)?.trim();
    const plan = (formData.get('plan') as string) === 'go' ? 'go' : 'zen';
    if (!apiKey) {
      return data({ error: 'Missing API key' }, { status: 400 });
    }
    try {
      await verifyChatCompletionsAccess(AiSettingsRepository.zenBaseUrlForPlan(plan), apiKey);
    } catch (error) {
      return data(
        { error: error instanceof Error ? error.message : 'Could not verify that API key.' },
        { status: 400 },
      );
    }
    await AiSettingsRepository.setZenSettings({ apiKey, model, plan });
    return { success: true };
  }

  if (intent === 'listZenModels') {
    const typedKey = (formData.get('apiKey') as string)?.trim();
    const plan = (formData.get('plan') as string) === 'go' ? 'go' : 'zen';
    const apiKey = typedKey || (await AiSettingsRepository.getZenApiKeyPlain());
    if (!apiKey) {
      return data({ error: 'Enter an API key first' }, { status: 400 });
    }
    try {
      const models = await listChatCompletionsModels(AiSettingsRepository.zenBaseUrlForPlan(plan), apiKey);
      return { models };
    } catch {
      return data({ error: 'Could not load models — check the API key.' }, { status: 400 });
    }
  }

  if (intent === 'updateZenModel') {
    const model = (formData.get('model') as string)?.trim();
    if (!model) {
      return data({ error: 'Missing model' }, { status: 400 });
    }
    const settings = await AiSettingsRepository.getZenSettings();
    const apiKey = await AiSettingsRepository.getZenApiKeyPlain();
    if (!settings.configured || !apiKey) {
      return data({ error: 'OpenCode is not configured' }, { status: 400 });
    }
    try {
      await verifyChatCompletionsAccess(AiSettingsRepository.zenBaseUrlForPlan(settings.plan), apiKey);
    } catch (error) {
      return data(
        { error: error instanceof Error ? error.message : 'Could not verify that API key.' },
        { status: 400 },
      );
    }
    await AiSettingsRepository.updateZenModel(model);
    return { success: true };
  }

  if (intent === 'clearZenSettings') {
    await AiSettingsRepository.clearZenSettings();
    return { success: true };
  }

  if (intent === 'saveCustomSettings') {
    const baseUrl = (formData.get('baseUrl') as string)?.trim();
    const model = (formData.get('model') as string)?.trim();
    const apiKey = (formData.get('apiKey') as string)?.trim();
    if (!baseUrl || !model) {
      return data({ error: 'Missing base URL or model' }, { status: 400 });
    }
    try {
      await verifyChatCompletionsAccess(baseUrl, apiKey || null);
    } catch (error) {
      return data(
        { error: error instanceof Error ? error.message : 'Could not verify that endpoint.' },
        { status: 400 },
      );
    }
    await AiSettingsRepository.setCustomSettings({ baseUrl, model, apiKey: apiKey || undefined });
    return { success: true };
  }

  if (intent === 'clearCustomSettings') {
    await AiSettingsRepository.clearCustomSettings();
    return { success: true };
  }

  if (intent === 'restartServer') {
    const accessError = await requireSystemControlAccess(request);
    if (accessError) {
      return accessError;
    }
    const result = await restartServer();
    if (!result.success) {
      return data({ error: result.error }, { status: 500 });
    }
    return { success: true };
  }

  if (intent === 'rebootPi') {
    const accessError = await requireSystemControlAccess(request);
    if (accessError) {
      return accessError;
    }
    const result = await rebootPi();
    if (!result.success) {
      return data({ error: result.error }, { status: 500 });
    }
    return { success: true };
  }

  if (intent === 'shutdownPi') {
    const accessError = await requireSystemControlAccess(request);
    if (accessError) {
      return accessError;
    }
    const result = await shutdownPi();
    if (!result.success) {
      return data({ error: result.error }, { status: 500 });
    }
    return { success: true };
  }

  if (intent === 'toggleBluetooth') {
    const accessError = await requireSystemControlAccess(request);
    if (accessError) {
      return accessError;
    }
    const result = await setBluetoothEnabled(formData.get('enabled') === 'true');
    if (!result.success) {
      return data({ error: result.error }, { status: 500 });
    }
    return { success: true };
  }

  if (intent === 'toggleWifiClient') {
    const accessError = await requireSystemControlAccess(request);
    if (accessError) {
      return accessError;
    }
    const result = await setWifiClientEnabled(formData.get('enabled') === 'true');
    if (!result.success) {
      return data({ error: result.error }, { status: 500 });
    }
    return { success: true };
  }

  if (intent === 'checkInternet') {
    const accessError = await requireSystemControlAccess(request);
    if (accessError) {
      return accessError;
    }
    const connected = await checkInternetConnectivity({ retries: 1, timeoutMs: 4000 });
    return { success: true, connected };
  }

  if (intent === 'checkUpdates') {
    const accessError = await requireSystemControlAccess(request);
    if (accessError) {
      return accessError;
    }
    const result = await checkForUpdates();
    if (!result.success) {
      return data({ error: result.error }, { status: 500 });
    }
    return { success: true, updates: result.updates };
  }

  if (intent === 'applyUpdates') {
    const accessError = await requireSystemControlAccess(request);
    if (accessError) {
      return accessError;
    }
    const result = await startUpdates();
    if (!result.success) {
      return data({ error: result.error }, { status: 500 });
    }
    return { success: true };
  }

  if (intent === 'updateStatus') {
    const accessError = await requireSystemControlAccess(request);
    if (accessError) {
      return accessError;
    }
    return { success: true, status: await getUpdateStatus() };
  }

  if (intent === 'deleteUser') {
    const id = parseInt(formData.get('id') as string);
    const users = await UserRepository.listUsers();
    if (users.length <= 1) {
      return data({ error: 'At least one user must remain' }, { status: 400 });
    }
    await UserRepository.deleteUser(id);
    return { success: true };
  }

  return data({ error: 'Unknown intent' }, { status: 400 });
};

export { Settings as default } from '~/pages/Settings';
