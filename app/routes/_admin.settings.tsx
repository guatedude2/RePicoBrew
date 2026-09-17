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
import type { DeviceType } from '~/types';
import { isRaspberryPi } from '~/utils/platform.server';
import { serializeDates } from '~/utils/serialize.server';
import { listNearbyNetworks } from '~/utils/wifi.server';

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
    nearbyNetworks,
    openAiSettings,
    claudeSettings,
    zenSettings,
    customSettings,
    activeProvider,
  ] = await Promise.all([
    DeviceRepository.listDevices(),
    DeviceRepository.listDiscoveredDevices(),
    UserRepository.listUsers(),
    ConfigRepository.getConfig<string>('SERVER_HOSTNAME'),
    ConfigRepository.getConfig<WifiConfig>('ACCESS_POINT'),
    ConfigRepository.getConfig<WifiConfig>('WIFI'),
    listNearbyNetworks(),
    AiSettingsRepository.getOpenAiSettings(),
    AiSettingsRepository.getClaudeSettings(),
    AiSettingsRepository.getZenSettings(),
    AiSettingsRepository.getCustomSettings(),
    AiSettingsRepository.getActiveProviderName(),
  ]);
  return serializeDates({
    devices: devices.map((device) => ({ ...device, online: DeviceRepository.isDeviceOnline(device) })),
    discoveredDevices,
    users,
    hostname: hostname ?? '',
    accessPoint: accessPoint ?? { name: '', password: '' },
    wifi: wifi ?? { name: '', password: '' },
    nearbyNetworks,
    isRpi: isRaspberryPi(),
    hasAiKey:
      openAiSettings.configured || claudeSettings.configured || zenSettings.configured || customSettings.configured,
    openAiSettings,
    claudeSettings,
    zenSettings,
    customSettings,
    activeProvider,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
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

  if (intent === 'saveGeneral') {
    const hostname = formData.get('hostname') as string;
    if (!hostname) {
      return data({ error: 'Missing hostname' }, { status: 400 });
    }
    await ConfigRepository.setConfig('SERVER_HOSTNAME', hostname);
    // A real Pi deployment would also re-run `hostnamectl set-hostname`/avahi restart here.
    return { success: true };
  }

  if (intent === 'saveAccessPoint') {
    const name = formData.get('name') as string;
    const password = formData.get('password') as string;
    if (!name || !password) {
      return data({ error: 'Missing AP network name or password' }, { status: 400 });
    }
    await ConfigRepository.setConfig<WifiConfig>('ACCESS_POINT', { name, password });
    // A real Pi deployment would also rewrite hostapd.conf and restart the hostapd service here.
    return { success: true };
  }

  if (intent === 'saveWifi') {
    const name = formData.get('name') as string;
    const password = formData.get('password') as string;
    if (!name || !password) {
      return data({ error: 'Missing Wi-Fi network name or password' }, { status: 400 });
    }
    await ConfigRepository.setConfig<WifiConfig>('WIFI', { name, password });
    // A real Pi deployment would also rewrite wpa_supplicant.conf and restart networking here.
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
