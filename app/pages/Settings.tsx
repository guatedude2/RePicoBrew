import { useFetcher, useLoaderData, useRouteLoaderData } from 'react-router';
import { useEffect, useRef, useState, type FC } from 'react';
import { MdCheckCircle, MdInfoOutline, MdOutlineRemoveRedEye } from 'react-icons/md';
import { RiEyeCloseLine } from 'react-icons/ri';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select } from '~/components/ui/select';
import { Switch } from '~/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { DevicesCard } from '~/components/settings/DevicesCard';
import { SystemCard } from '~/components/settings/SystemCard';
import { WifiNetworkPicker } from '~/components/WifiNetworkPicker';
import { UsersCard } from '~/components/settings/UsersCard';
import { cn } from '~/lib/utils';

import type { SaveState } from './Settings/settings-reducer';
import { useSettingsReducer } from './Settings/settings-reducer';
import { useTimeFormat } from '~/utils/time-format';
import { useWeightUnit } from '~/utils/weight-unit';

const SectionHeading: FC<{ title: string; description: string }> = ({ title, description }) => (
  <>
    <p className="text-[17px] font-bold">{title}</p>
    <p className="my-2 text-[13px] leading-relaxed text-ink-text-dim">{description}</p>
  </>
);

const FieldLabel: FC<{ htmlFor?: string; children: React.ReactNode }> = ({ htmlFor, children }) => (
  <Label htmlFor={htmlFor} className="mb-1.5 block">
    {children}
  </Label>
);

const SAVE_LABEL: Record<SaveState, string> = {
  idle: 'Save Changes',
  saving: 'Saving…',
};

const SaveButton: FC<{ saveState: SaveState; onClick: () => void; disabled?: boolean; savingLabel?: string }> = ({
  saveState,
  onClick,
  disabled,
  savingLabel,
}) => (
  <Button variant="brand" className="mt-4 self-start" disabled={disabled || saveState !== 'idle'} onClick={onClick}>
    {saveState === 'saving' && savingLabel ? savingLabel : SAVE_LABEL[saveState]}
  </Button>
);

const RpiOnlyNotice: FC = () => (
  <div className="mb-4 flex items-center gap-2 rounded-lg border border-info-500 bg-info-100 px-3.5 py-2.5 text-[13px] font-semibold text-info-500">
    <MdInfoOutline className="size-4 shrink-0" />
    These are Raspberry Pi settings. This server isn&apos;t running on a Raspberry Pi, so they&apos;re read-only here.
  </div>
);

function internetStatusLabel(fetcherState: 'idle' | 'loading' | 'submitting', connected: boolean | undefined) {
  if (fetcherState !== 'idle') {
    return 'Checking internet…';
  }
  if (connected === undefined) {
    return 'Internet status unknown';
  }
  return connected ? 'Internet connected' : 'No internet access';
}

const AI_PROVIDER_LABEL: Record<string, string> = {
  openai: 'OpenAI',
  claude: 'Claude',
  'opencode-zen': 'OpenCode',
  custom: 'Custom / Local',
};

const ConfiguredRow: FC<{ label: string; onRemove: () => void; disabled: boolean }> = ({
  label,
  onRemove,
  disabled,
}) => (
  <div className="flex w-full items-center justify-between gap-3 rounded-lg border border-ink-divider bg-ink-bg px-4 py-3 md:w-3/5">
    <div className="flex items-center gap-2 text-sm text-ink-text-secondary">
      <MdCheckCircle className="size-4 shrink-0 text-success-500" />
      {label}
    </div>
    <Button variant="outline" size="sm" disabled={disabled} onClick={onRemove}>
      Remove
    </Button>
  </div>
);

export const Settings: FC = () => {
  const {
    devices,
    discoveredDevices,
    users,
    hostname,
    accessPoint,
    wifi,
    isRpi,
    openAiSettings,
    claudeSettings,
    zenSettings,
    customSettings,
    activeProvider,
    systemInfo,
    bluetoothEnabled,
    wifiClientEnabled,
  } = useLoaderData<typeof import('~/routes/_admin.settings').loader>();
  const adminData = useRouteLoaderData<typeof import('~/routes/_admin').loader>('routes/_admin');
  const canControlSystem = adminData?.session?.role !== 'ReadOnly';
  const { state, actions, dispatch } = useSettingsReducer();
  // Bypasses a generics-inference quirk in the shared tiny-reducer helper that collapses these
  // three action creators' payload type to `never` when mixed with the larger reducer map; the
  // runtime behavior is identical to calling actions.setXSaveState(...) directly.
  const setGeneralSaveState = (payload: SaveState) => dispatch({ type: 'setGeneralSaveState', payload });
  const setApSaveState = (payload: SaveState) => dispatch({ type: 'setApSaveState', payload });
  const setWifiSaveState = (payload: SaveState) => dispatch({ type: 'setWifiSaveState', payload });

  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) {
      return;
    }
    hydrated.current = true;
    actions.hydrate({
      hostName: hostname,
      apNetworkName: accessPoint.name,
      apPassword: accessPoint.password,
      wifiNetworkName: wifi.name,
      wifiPassword: wifi.password,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generalFetcher = useFetcher();
  const timeFormatFetcher = useFetcher<{ error?: string }>();
  const savedTimeFormat = useTimeFormat();
  const timeFormat = (timeFormatFetcher.formData?.get('timeFormat') as string | null | undefined) ?? savedTimeFormat;
  const weightUnitFetcher = useFetcher<{ error?: string }>();
  const savedWeightUnit = useWeightUnit();
  const weightUnit = (weightUnitFetcher.formData?.get('weightUnit') as string | null | undefined) ?? savedWeightUnit;
  const apFetcher = useFetcher();
  const wifiFetcher = useFetcher();
  const wifiRadioFetcher = useFetcher();
  // Optimistic: flips immediately on click rather than waiting for the loader to refetch.
  const pendingWifiRadioEnabled = wifiRadioFetcher.formData?.get('enabled');
  const wifiRadioOn = pendingWifiRadioEnabled === undefined ? wifiClientEnabled : pendingWifiRadioEnabled === 'true';
  const toggleWifiRadio = () => {
    wifiRadioFetcher.submit({ intent: 'toggleWifiClient', enabled: String(!wifiRadioOn) }, { method: 'post' });
  };

  const internetFetcher = useFetcher<{ connected?: boolean }>();
  useEffect(() => {
    if (isRpi) {
      internetFetcher.submit({ intent: 'checkInternet' }, { method: 'post' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runSave = (fetcher: any, setSaveState: (s: SaveState) => void, body: Record<string, string>) => {
    setSaveState('saving');
    fetcher.submit(body, { method: 'post' });
  };

  // The backend action itself now actually applies (and, for Wi-Fi, verifies internet access)
  // before responding, so the fetcher's own submitting -> idle transition already spans the real
  // operation — no more client-side fake "restarting" delay needed.
  useEffect(() => {
    if (generalFetcher.state === 'idle' && state.generalSaveState === 'saving') {
      setGeneralSaveState('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generalFetcher.state]);

  useEffect(() => {
    if (apFetcher.state === 'idle' && state.apSaveState === 'saving') {
      setApSaveState('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apFetcher.state]);

  useEffect(() => {
    if (wifiFetcher.state === 'idle' && state.wifiSaveState === 'saving') {
      setWifiSaveState('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wifiFetcher.state]);

  const saveGeneralSection = () => {
    actions.validateHostnameSection((valid) => {
      if (!valid) {
        return;
      }
      runSave(generalFetcher, setGeneralSaveState, { intent: 'saveGeneral', hostname: state.hostName });
    });
  };

  const saveAccessPoint = () =>
    runSave(apFetcher, setApSaveState, {
      intent: 'saveAccessPoint',
      name: state.apNetworkName,
      password: state.apPassword,
    });

  const saveWifi = () =>
    runSave(wifiFetcher, setWifiSaveState, {
      intent: 'saveWifi',
      name: state.wifiNetworkName,
      password: state.wifiPassword,
    });

  const [showAPPassword, setShowAPPassword] = useState(false);
  const [showWifiPassword, setShowWifiPassword] = useState(false);
  const [manualWifiEntry, setManualWifiEntry] = useState(false);

  const [selectedProvider, setSelectedProvider] = useState(activeProvider ?? 'openai');

  const [openAiApiKey, setOpenAiApiKey] = useState('');
  const [openAiModel, setOpenAiModel] = useState(openAiSettings.model);
  const [openAiModelOptions, setOpenAiModelOptions] = useState<string[]>([]);
  const openAiFetcher = useFetcher<{ error?: string }>();
  const isOpenAiSaving = openAiFetcher.state !== 'idle';
  const openAiModelsFetcher = useFetcher<{ models?: string[]; error?: string }>();
  const isLoadingOpenAiModels = openAiModelsFetcher.state !== 'idle';
  useEffect(() => {
    if (openAiModelsFetcher.data?.models) {
      const models = openAiModelsFetcher.data.models;
      setOpenAiModelOptions(models);
      setOpenAiModel((prev) => (models.includes(prev) ? prev : models[0] ?? prev));
    }
  }, [openAiModelsFetcher.data]);
  // Auto-loads the model list shortly after the user stops typing an API key, so the field can
  // switch from a free-text input to a dropdown of models that key actually has access to.
  useEffect(() => {
    if (!openAiApiKey) {
      setOpenAiModelOptions([]);
      return;
    }
    const timeout = setTimeout(() => {
      openAiModelsFetcher.submit({ intent: 'listOpenAiModels', apiKey: openAiApiKey }, { method: 'post' });
    }, 600);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openAiApiKey]);

  const [claudeApiKey, setClaudeApiKey] = useState('');
  const [claudeModel, setClaudeModel] = useState(claudeSettings.model);
  const [claudeModelOptions, setClaudeModelOptions] = useState<string[]>([]);
  const claudeFetcher = useFetcher<{ error?: string }>();
  const isClaudeSaving = claudeFetcher.state !== 'idle';
  const claudeModelsFetcher = useFetcher<{ models?: string[]; error?: string }>();
  const isLoadingClaudeModels = claudeModelsFetcher.state !== 'idle';
  useEffect(() => {
    if (claudeModelsFetcher.data?.models) {
      const models = claudeModelsFetcher.data.models;
      setClaudeModelOptions(models);
      setClaudeModel((prev) => (models.includes(prev) ? prev : models[0] ?? prev));
    }
  }, [claudeModelsFetcher.data]);
  useEffect(() => {
    if (!claudeApiKey) {
      setClaudeModelOptions([]);
      return;
    }
    const timeout = setTimeout(() => {
      claudeModelsFetcher.submit({ intent: 'listClaudeModels', apiKey: claudeApiKey }, { method: 'post' });
    }, 600);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claudeApiKey]);

  const [zenApiKey, setZenApiKey] = useState('');
  const [zenPlan, setZenPlan] = useState<'zen' | 'go'>(zenSettings.plan);
  const [zenModel, setZenModel] = useState(zenSettings.model);
  const [zenModelOptions, setZenModelOptions] = useState<string[]>([]);
  const zenFetcher = useFetcher<{ error?: string }>();
  const isZenSaving = zenFetcher.state !== 'idle';
  const zenModelsFetcher = useFetcher<{ models?: string[]; error?: string }>();
  const isLoadingZenModels = zenModelsFetcher.state !== 'idle';
  const ZEN_PLAN_DEFAULT_MODEL: Record<'zen' | 'go', string> = {
    zen: 'opencode/big-pickle',
    go: 'kimi-k3',
  };
  const handleZenPlanChange = (plan: 'zen' | 'go') => {
    setZenPlan(plan);
    setZenModel(ZEN_PLAN_DEFAULT_MODEL[plan]);
    setZenModelOptions([]);
  };
  useEffect(() => {
    if (zenModelsFetcher.data?.models) {
      const models = zenModelsFetcher.data.models;
      setZenModelOptions(models);
      setZenModel((prev) => (models.includes(prev) ? prev : models[0] ?? prev));
    }
  }, [zenModelsFetcher.data]);
  useEffect(() => {
    if (!zenApiKey) {
      setZenModelOptions([]);
      return;
    }
    const timeout = setTimeout(() => {
      zenModelsFetcher.submit({ intent: 'listZenModels', apiKey: zenApiKey, plan: zenPlan }, { method: 'post' });
    }, 600);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zenApiKey, zenPlan]);

  const [isEditingZenModel, setIsEditingZenModel] = useState(false);
  const [zenEditModel, setZenEditModel] = useState(zenSettings.model);
  const zenModelUpdateFetcher = useFetcher<{ error?: string }>();
  const isUpdatingZenModel = zenModelUpdateFetcher.state !== 'idle';
  const openZenModelEditor = () => {
    setZenEditModel(zenSettings.model);
    setIsEditingZenModel(true);
    zenModelsFetcher.submit({ intent: 'listZenModels', plan: zenSettings.plan }, { method: 'post' });
  };
  useEffect(() => {
    if (zenModelUpdateFetcher.state === 'idle' && zenModelUpdateFetcher.data && !zenModelUpdateFetcher.data.error) {
      setIsEditingZenModel(false);
    }
  }, [zenModelUpdateFetcher.state, zenModelUpdateFetcher.data]);

  const [customBaseUrl, setCustomBaseUrl] = useState(customSettings.baseUrl);
  const [customModel, setCustomModel] = useState(customSettings.model);
  const [customApiKey, setCustomApiKey] = useState('');
  const customFetcher = useFetcher<{ error?: string }>();
  const isCustomSaving = customFetcher.state !== 'idle';

  return (
    <div className="flex max-w-[760px] flex-col gap-4">
      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="access-point">Access Point</TabsTrigger>
          <TabsTrigger value="wifi">Wi-Fi</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="ai">AI</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card className="flex flex-col p-6">
            <SectionHeading
              title="General"
              description="Custom hostname for your server — useful with multiple Raspberry Pi devices or a more memorable address."
            />
            {!isRpi && <RpiOnlyNotice />}
            <div className="w-full md:w-3/5">
              <FieldLabel htmlFor="hostname">Hostname</FieldLabel>
              <Input
                id="hostname"
                name="hostname"
                required
                placeholder="Hostname"
                value={state.hostName}
                disabled={!isRpi}
                onKeyDown={(event) => (/[^\w.-]/.test(event.key) ? event.preventDefault() : null)}
                onChange={(event) => actions.setHostName(event.target.value)}
              />
              {state.isHostNameError ? <p className="mt-1.5 text-xs text-danger-500">{state.isHostNameError}</p> : null}
            </div>
            {generalFetcher.data?.error ? (
              <p className="mt-2 text-xs text-danger-500">{generalFetcher.data.error}</p>
            ) : null}
            <SaveButton saveState={state.generalSaveState} onClick={saveGeneralSection} disabled={!isRpi} />
          </Card>

          <Card className="mt-4 flex flex-col p-6">
            <SectionHeading title="Time format" description="How times are shown on graphs and in the session list." />
            <div className="w-full md:w-3/5">
              <FieldLabel htmlFor="time-format">Clock</FieldLabel>
              <Select
                id="time-format"
                value={timeFormat}
                onChange={(event) =>
                  timeFormatFetcher.submit(
                    { intent: 'saveTimeFormat', timeFormat: event.target.value },
                    { method: 'post' },
                  )
                }
              >
                <option value="12h">12-hour (3:45 PM)</option>
                <option value="24h">24-hour (15:45)</option>
              </Select>
              {timeFormatFetcher.data?.error ? (
                <p className="mt-1.5 text-xs text-danger-500">{timeFormatFetcher.data.error}</p>
              ) : null}
            </div>
          </Card>

          <Card className="mt-4 flex flex-col p-6">
            <SectionHeading
              title="Units"
              description="How ingredient amounts are shown and entered in the recipe editor."
            />
            <div className="w-full md:w-3/5">
              <FieldLabel htmlFor="weight-unit">Weight</FieldLabel>
              <Select
                id="weight-unit"
                value={weightUnit}
                onChange={(event) =>
                  weightUnitFetcher.submit(
                    { intent: 'saveWeightUnit', weightUnit: event.target.value },
                    { method: 'post' },
                  )
                }
              >
                <option value="oz">Ounces (oz)</option>
                <option value="g">Grams (g)</option>
              </Select>
              {weightUnitFetcher.data?.error ? (
                <p className="mt-1.5 text-xs text-danger-500">{weightUnitFetcher.data.error}</p>
              ) : null}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="access-point">
          <Card className="flex flex-col p-6">
            <SectionHeading
              title="Access Point"
              description="Broadcasts the network for your Picobrew devices to connect to."
            />
            {!isRpi && <RpiOnlyNotice />}
            <div className="flex w-full flex-col gap-3.5 md:w-3/5">
              <div>
                <FieldLabel htmlFor="ap-name">AP Network Name</FieldLabel>
                <Input
                  id="ap-name"
                  name="ap-name"
                  required
                  placeholder="AP Network Name"
                  value={state.apNetworkName}
                  disabled={!isRpi}
                  onChange={(event) => actions.setApNetworkName(event.target.value)}
                />
              </div>
              <div>
                <FieldLabel htmlFor="ap-password">Password (WPA2)</FieldLabel>
                <div className="relative">
                  <Input
                    id="ap-password"
                    name="ap-password"
                    required
                    placeholder="Password"
                    type={showAPPassword ? 'text' : 'password'}
                    value={state.apPassword}
                    disabled={!isRpi}
                    className="pr-10"
                    onChange={(event) => actions.setApPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={showAPPassword ? 'Hide password' : 'Show password'}
                    disabled={!isRpi}
                    onClick={() => setShowAPPassword((v) => !v)}
                    className="absolute inset-y-0 right-3 flex items-center text-ink-text-faint disabled:pointer-events-none disabled:opacity-40"
                  >
                    {showAPPassword ? (
                      <RiEyeCloseLine className="size-4" />
                    ) : (
                      <MdOutlineRemoveRedEye className="size-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
            {apFetcher.data?.error ? <p className="mt-2 text-xs text-danger-500">{apFetcher.data.error}</p> : null}
            <SaveButton saveState={state.apSaveState} onClick={saveAccessPoint} disabled={!isRpi} />
          </Card>
        </TabsContent>

        <TabsContent value="wifi">
          <Card className="flex flex-col p-6">
            <div className="flex items-start justify-between gap-3">
              <SectionHeading
                title="Wi-Fi"
                description="Upstream network connecting the Raspberry Pi to your router and the internet."
              />
              <div className="flex flex-none items-center gap-2 pt-0.5">
                <Label htmlFor="wifi-radio-toggle" className="text-[13px] font-semibold">
                  Wi-Fi Radio
                </Label>
                <Switch
                  id="wifi-radio-toggle"
                  checked={wifiRadioOn}
                  disabled={!isRpi || !canControlSystem}
                  onCheckedChange={toggleWifiRadio}
                />
              </div>
            </div>
            {isRpi && (
              <div className="mb-3.5 flex items-center gap-1.5 text-[13px]">
                <span
                  className={cn(
                    'size-2 rounded-full',
                    internetFetcher.data?.connected
                      ? 'bg-success-500 shadow-[0_0_8px_var(--color-success-500)]'
                      : 'bg-ink-text-faintest',
                  )}
                />
                <span className={internetFetcher.data?.connected ? 'text-success-500' : 'text-ink-text-faint'}>
                  {internetStatusLabel(internetFetcher.state, internetFetcher.data?.connected)}
                </span>
              </div>
            )}
            {!isRpi && <RpiOnlyNotice />}
            <div className="flex w-full flex-col gap-3.5 md:w-3/5">
              <div>
                <FieldLabel htmlFor="wifi-name">Network Name</FieldLabel>
                <WifiNetworkPicker
                  knownSsid={wifi.name || null}
                  selectedSsid={state.wifiNetworkName}
                  onSelect={actions.setWifiNetworkName}
                  manualMode={manualWifiEntry}
                  onEnterManually={() => setManualWifiEntry(true)}
                  onShowList={() => setManualWifiEntry(false)}
                  manualValue={state.wifiNetworkName}
                  onManualChange={actions.setWifiNetworkName}
                  disabled={!isRpi}
                />
              </div>
              <div>
                <FieldLabel htmlFor="wifi-password">Password (WPA2)</FieldLabel>
                <div className="relative">
                  <Input
                    id="wifi-password"
                    name="wifi-password"
                    required
                    placeholder="Password"
                    type={showWifiPassword ? 'text' : 'password'}
                    value={state.wifiPassword}
                    disabled={!isRpi}
                    className="pr-10"
                    onChange={(event) => actions.setWifiPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={showWifiPassword ? 'Hide password' : 'Show password'}
                    disabled={!isRpi}
                    onClick={() => setShowWifiPassword((v) => !v)}
                    className="absolute inset-y-0 right-3 flex items-center text-ink-text-faint disabled:pointer-events-none disabled:opacity-40"
                  >
                    {showWifiPassword ? (
                      <RiEyeCloseLine className="size-4" />
                    ) : (
                      <MdOutlineRemoveRedEye className="size-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
            {wifiFetcher.data?.error ? <p className="mt-2 text-xs text-danger-500">{wifiFetcher.data.error}</p> : null}
            <SaveButton
              saveState={state.wifiSaveState}
              onClick={saveWifi}
              disabled={!isRpi}
              savingLabel="Connecting & checking internet…"
            />
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <UsersCard users={users} />
        </TabsContent>

        <TabsContent value="devices">
          <DevicesCard
            devices={devices}
            discoveredDevices={discoveredDevices}
            bluetoothEnabled={bluetoothEnabled}
            canToggleBluetooth={isRpi && canControlSystem}
          />
        </TabsContent>

        <TabsContent value="ai">
          <Card className="flex flex-col p-6">
            <SectionHeading
              title="AI"
              description="Choose a provider for AI-generated brewing and fermentation advice, plus on-demand Ask AI on a session."
            />

            <div className="w-full md:w-3/5">
              <FieldLabel htmlFor="ai-provider">Provider</FieldLabel>
              <Select
                id="ai-provider"
                value={selectedProvider}
                onChange={(event) => setSelectedProvider(event.target.value as typeof selectedProvider)}
              >
                <option value="openai">OpenAI</option>
                <option value="claude">Claude</option>
                <option value="opencode-zen">OpenCode</option>
                <option value="custom">Custom / Local</option>
              </Select>
              {activeProvider && activeProvider !== selectedProvider && (
                <p className="mt-1.5 text-xs text-ink-text-faint">
                  Currently active:{' '}
                  <span className="font-semibold text-ink-text-secondary">{AI_PROVIDER_LABEL[activeProvider]}</span>
                </p>
              )}
            </div>

            {selectedProvider === 'openai' && (
              <div className="mt-4 flex flex-col gap-3">
                <p className="text-[13px] text-ink-text-dim">Uses OpenAI's Platform API.</p>
                {openAiSettings.configured ? (
                  <ConfiguredRow
                    label={`Configured · ${openAiSettings.model}`}
                    disabled={isOpenAiSaving}
                    onRemove={() => openAiFetcher.submit({ intent: 'clearOpenAiApiKey' }, { method: 'post' })}
                  />
                ) : (
                  <div className="flex w-full flex-col gap-3.5 md:w-3/5">
                    <div>
                      <FieldLabel htmlFor="openai-api-key">OpenAI API Key</FieldLabel>
                      <Input
                        id="openai-api-key"
                        type="password"
                        autoComplete="off"
                        placeholder="sk-..."
                        value={openAiApiKey}
                        onChange={(event) => setOpenAiApiKey(event.target.value)}
                      />
                    </div>
                    <div>
                      <FieldLabel htmlFor="openai-model">Model</FieldLabel>
                      {openAiModelOptions.length > 0 ? (
                        <Select
                          id="openai-model"
                          value={openAiModel}
                          onChange={(event) => setOpenAiModel(event.target.value)}
                        >
                          {openAiModelOptions.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Input
                          id="openai-model"
                          placeholder="gpt-4o-mini"
                          value={openAiModel}
                          onChange={(event) => setOpenAiModel(event.target.value)}
                        />
                      )}
                      {isLoadingOpenAiModels ? (
                        <p className="mt-1.5 text-xs text-ink-text-faint">Loading available models…</p>
                      ) : openAiModelsFetcher.data?.error ? (
                        <p className="mt-1.5 text-xs text-danger-500">{openAiModelsFetcher.data.error}</p>
                      ) : (
                        <p className="mt-1.5 text-xs text-ink-text-faint">
                          Models load automatically once you enter a valid API key.
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {openAiFetcher.data?.error ? (
                  <p className="text-xs text-danger-500">{openAiFetcher.data.error}</p>
                ) : null}
                {!openAiSettings.configured && (
                  <Button
                    variant="brand"
                    className="self-start"
                    disabled={!openAiApiKey || isOpenAiSaving}
                    onClick={() =>
                      openAiFetcher.submit(
                        { intent: 'saveOpenAiApiKey', apiKey: openAiApiKey, model: openAiModel },
                        { method: 'post' },
                      )
                    }
                  >
                    {isOpenAiSaving ? 'Saving…' : 'Save Changes'}
                  </Button>
                )}
              </div>
            )}

            {selectedProvider === 'claude' && (
              <div className="mt-4 flex flex-col gap-3">
                <p className="text-[13px] text-ink-text-dim">Uses Anthropic's API.</p>
                {claudeSettings.configured ? (
                  <ConfiguredRow
                    label={`Configured · ${claudeSettings.model}`}
                    disabled={isClaudeSaving}
                    onRemove={() => claudeFetcher.submit({ intent: 'clearClaudeApiKey' }, { method: 'post' })}
                  />
                ) : (
                  <div className="flex w-full flex-col gap-3.5 md:w-3/5">
                    <div>
                      <FieldLabel htmlFor="claude-api-key">Claude API Key</FieldLabel>
                      <Input
                        id="claude-api-key"
                        type="password"
                        autoComplete="off"
                        placeholder="sk-ant-..."
                        value={claudeApiKey}
                        onChange={(event) => setClaudeApiKey(event.target.value)}
                      />
                    </div>
                    <div>
                      <FieldLabel htmlFor="claude-model">Model</FieldLabel>
                      {claudeModelOptions.length > 0 ? (
                        <Select
                          id="claude-model"
                          value={claudeModel}
                          onChange={(event) => setClaudeModel(event.target.value)}
                        >
                          {claudeModelOptions.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Input
                          id="claude-model"
                          placeholder="claude-haiku-4-5-20251001"
                          value={claudeModel}
                          onChange={(event) => setClaudeModel(event.target.value)}
                        />
                      )}
                      {isLoadingClaudeModels ? (
                        <p className="mt-1.5 text-xs text-ink-text-faint">Loading available models…</p>
                      ) : claudeModelsFetcher.data?.error ? (
                        <p className="mt-1.5 text-xs text-danger-500">{claudeModelsFetcher.data.error}</p>
                      ) : (
                        <p className="mt-1.5 text-xs text-ink-text-faint">
                          Models load automatically once you enter a valid API key.
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {claudeFetcher.data?.error ? (
                  <p className="text-xs text-danger-500">{claudeFetcher.data.error}</p>
                ) : null}
                {!claudeSettings.configured && (
                  <Button
                    variant="brand"
                    className="self-start"
                    disabled={!claudeApiKey || isClaudeSaving}
                    onClick={() =>
                      claudeFetcher.submit(
                        { intent: 'saveClaudeApiKey', apiKey: claudeApiKey, model: claudeModel },
                        { method: 'post' },
                      )
                    }
                  >
                    {isClaudeSaving ? 'Saving…' : 'Save Changes'}
                  </Button>
                )}
              </div>
            )}

            {selectedProvider === 'opencode-zen' && (
              <div className="mt-4 flex flex-col gap-3">
                <p className="text-[13px] text-ink-text-dim">
                  OpenCode's hosted models — either the pay-as-you-go Zen gateway or the flat-rate Go plan. Even free
                  Zen models require a card on file with OpenCode.
                </p>
                {zenSettings.configured ? (
                  <div className="flex w-full flex-col gap-2 md:w-3/5">
                    <ConfiguredRow
                      label={`${zenSettings.plan === 'go' ? 'Go' : 'Zen'} · ${zenSettings.model}`}
                      disabled={isZenSaving}
                      onRemove={() => zenFetcher.submit({ intent: 'clearZenSettings' }, { method: 'post' })}
                    />
                    {isEditingZenModel ? (
                      <div className="flex flex-col gap-2 rounded-lg border border-ink-divider p-3">
                        {zenModelOptions.length > 0 ? (
                          <Select value={zenEditModel} onChange={(event) => setZenEditModel(event.target.value)}>
                            {zenModelOptions.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <Input value={zenEditModel} onChange={(event) => setZenEditModel(event.target.value)} />
                        )}
                        {isLoadingZenModels ? (
                          <p className="text-xs text-ink-text-faint">Loading available models…</p>
                        ) : null}
                        {zenModelUpdateFetcher.data?.error ? (
                          <p className="text-xs text-danger-500">{zenModelUpdateFetcher.data.error}</p>
                        ) : null}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="brand"
                            disabled={isUpdatingZenModel}
                            onClick={() =>
                              zenModelUpdateFetcher.submit(
                                { intent: 'updateZenModel', model: zenEditModel },
                                { method: 'post' },
                              )
                            }
                          >
                            {isUpdatingZenModel ? 'Saving…' : 'Save Model'}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setIsEditingZenModel(false)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="self-start text-xs font-semibold text-brand-500 hover:underline"
                        onClick={openZenModelEditor}
                      >
                        Change model
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex w-full flex-col gap-3.5 md:w-3/5">
                    <div>
                      <FieldLabel htmlFor="zen-plan">Plan</FieldLabel>
                      <Select
                        id="zen-plan"
                        value={zenPlan}
                        onChange={(event) => handleZenPlanChange(event.target.value as 'zen' | 'go')}
                      >
                        <option value="zen">Zen (pay-as-you-go)</option>
                        <option value="go">Go ($10/mo flat rate)</option>
                      </Select>
                    </div>
                    <div>
                      <FieldLabel htmlFor="zen-api-key">{zenPlan === 'go' ? 'Go' : 'Zen'} API Key</FieldLabel>
                      <Input
                        id="zen-api-key"
                        type="password"
                        autoComplete="off"
                        placeholder="API key"
                        value={zenApiKey}
                        onChange={(event) => setZenApiKey(event.target.value)}
                      />
                    </div>
                    <div>
                      <FieldLabel htmlFor="zen-model">Model</FieldLabel>
                      {zenModelOptions.length > 0 ? (
                        <Select id="zen-model" value={zenModel} onChange={(event) => setZenModel(event.target.value)}>
                          {zenModelOptions.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Input
                          id="zen-model"
                          placeholder={ZEN_PLAN_DEFAULT_MODEL[zenPlan]}
                          value={zenModel}
                          onChange={(event) => setZenModel(event.target.value)}
                        />
                      )}
                      {isLoadingZenModels ? (
                        <p className="mt-1.5 text-xs text-ink-text-faint">Loading available models…</p>
                      ) : zenModelsFetcher.data?.error ? (
                        <p className="mt-1.5 text-xs text-danger-500">{zenModelsFetcher.data.error}</p>
                      ) : (
                        <p className="mt-1.5 text-xs text-ink-text-faint">
                          Models load automatically once you enter a valid API key.
                        </p>
                      )}
                      {zenPlan === 'go' && (
                        <p className="mt-1.5 text-xs text-ink-text-faint">
                          Only Go's chat-completions models work here — GLM, Kimi, LongCat, DeepSeek V4.1/V4 Flash, and
                          Hy series. Grok, GPT 5.6 Luna, Muse, MiniMax, and Qwen use different wire formats and aren't
                          supported yet.
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {zenFetcher.data?.error ? <p className="text-xs text-danger-500">{zenFetcher.data.error}</p> : null}
                {!zenSettings.configured && (
                  <Button
                    variant="brand"
                    className="self-start"
                    disabled={!zenApiKey || isZenSaving}
                    onClick={() =>
                      zenFetcher.submit(
                        { intent: 'saveZenSettings', apiKey: zenApiKey, model: zenModel, plan: zenPlan },
                        { method: 'post' },
                      )
                    }
                  >
                    {isZenSaving ? 'Saving…' : 'Save Changes'}
                  </Button>
                )}
              </div>
            )}

            {selectedProvider === 'custom' && (
              <div className="mt-4 flex flex-col gap-3">
                <p className="text-[13px] text-ink-text-dim">
                  Point at any OpenAI-compatible server reachable from this device — Ollama, LM Studio, vLLM, LocalAI,
                  etc. running on other hardware on your network.
                </p>
                {customSettings.configured ? (
                  <ConfiguredRow
                    label={`${customSettings.baseUrl} · ${customSettings.model}`}
                    disabled={isCustomSaving}
                    onRemove={() => customFetcher.submit({ intent: 'clearCustomSettings' }, { method: 'post' })}
                  />
                ) : (
                  <div className="flex w-full flex-col gap-3.5 md:w-3/5">
                    <div>
                      <FieldLabel htmlFor="custom-base-url">Base URL</FieldLabel>
                      <Input
                        id="custom-base-url"
                        placeholder="http://192.168.1.50:11434/v1"
                        value={customBaseUrl}
                        onChange={(event) => setCustomBaseUrl(event.target.value)}
                      />
                    </div>
                    <div>
                      <FieldLabel htmlFor="custom-model">Model</FieldLabel>
                      <Input
                        id="custom-model"
                        placeholder="qwen2.5:3b"
                        value={customModel}
                        onChange={(event) => setCustomModel(event.target.value)}
                      />
                    </div>
                    <div>
                      <FieldLabel htmlFor="custom-api-key">API Key (optional)</FieldLabel>
                      <Input
                        id="custom-api-key"
                        type="password"
                        autoComplete="off"
                        placeholder="Leave blank if the server doesn't require one"
                        value={customApiKey}
                        onChange={(event) => setCustomApiKey(event.target.value)}
                      />
                    </div>
                  </div>
                )}
                {customFetcher.data?.error ? (
                  <p className="text-xs text-danger-500">{customFetcher.data.error}</p>
                ) : null}
                {!customSettings.configured && (
                  <Button
                    variant="brand"
                    className="self-start"
                    disabled={!customBaseUrl || !customModel || isCustomSaving}
                    onClick={() =>
                      customFetcher.submit(
                        {
                          intent: 'saveCustomSettings',
                          baseUrl: customBaseUrl,
                          model: customModel,
                          apiKey: customApiKey,
                        },
                        { method: 'post' },
                      )
                    }
                  >
                    {isCustomSaving ? 'Saving…' : 'Save Changes'}
                  </Button>
                )}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="system">
          <SystemCard systemInfo={systemInfo} isRpi={isRpi} canControlSystem={canControlSystem} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
