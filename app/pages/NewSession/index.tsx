import { Form, Link, useActionData, useFetcher, useNavigate, useNavigation } from 'react-router';
import { useEffect, useMemo, useRef, useState, type FC } from 'react';
import { MdArrowBack } from 'react-icons/md';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select } from '~/components/ui/select';
import { DeviceTypeIcon, iconKindForDevice } from '~/components/settings/DeviceTypeIcon';
import { cn } from '~/lib/utils';
import { DeviceType } from '~/types';
import { formatAbv, formatIbu } from '~/utils/brew-stats';
import { srmSwatchUrl } from '~/utils/srm-swatch';

const CARB_METHODS = [
  { label: 'Bottle', unit: 'weeks' },
  { label: 'Keg', unit: 'weeks' },
  { label: 'Forced (CO2)', unit: 'hours' },
];

interface RecipeOption {
  id: number;
  name: string;
  style: string | null;
  abv: number;
  ibu: number;
  photoUrl: string | null;
  colorSRM: number | null;
  fermentDays: number | null;
  steps: Array<{ stepTime: number; drainTime: number }>;
}

interface DeviceOption {
  id: number;
  name: string;
  color: string | null;
  deviceType: string;
  metadata: string | null;
  online: boolean;
}

interface NewSessionProps {
  recipes: RecipeOption[];
  brewDevices: DeviceOption[];
  tiltDevices: Array<Pick<DeviceOption, 'id' | 'name' | 'color'>>;
}

const formatMinutes = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) {
    return `${m}m`;
  }
  if (m === 0) {
    return `${h}h`;
  }
  return `${h}h ${m}m`;
};

// Pico S/C/Pro start a brew on the device itself: picking a recipe there makes it call the server's
// getRecipe endpoint, which creates the session and batch (see api.pico.getRecipe.ts). Starting one
// from the app too just makes a second, empty "manual" batch that never gets readings — so for these
// the page waits for the device instead of showing the form.
const STARTS_ON_DEVICE: string[] = [DeviceType.PICOBREW, DeviceType.PICOBREW_C];
const POLL_INTERVAL_MS = 3000;

const DeviceTile: FC<{ device: DeviceOption; onSelect: () => void }> = ({ device, onSelect }) => (
  <button
    type="button"
    onClick={onSelect}
    className="flex w-[124px] flex-col items-center gap-1.5 rounded-[10px] border border-ink-card-border bg-ink-bg px-2.5 py-3.5 transition-colors hover:border-brand-500 hover:bg-brand-100"
  >
    <DeviceTypeIcon kind={iconKindForDevice(device.deviceType, device.metadata)} size={34} color="ink-text-secondary" />
    <span className="w-full truncate text-center text-xs font-semibold text-ink-text">{device.name}</span>
    <span
      className={cn(
        'flex items-center gap-1 text-[10px] font-bold tracking-[0.5px]',
        device.online ? 'text-success-500' : 'text-ink-text-faint',
      )}
    >
      <span className={cn('size-1.5 rounded-full', device.online ? 'bg-success-500' : 'bg-ink-text-faintest')} />
      {device.online ? 'ONLINE' : 'OFFLINE'}
    </span>
  </button>
);

const ChooseDevice: FC<{
  brewDevices: DeviceOption[];
  onChoose: (device: DeviceOption) => void;
  onManual: () => void;
}> = ({ brewDevices, onChoose, onManual }) => (
  <Card className="max-w-[720px] gap-4 p-[22px]">
    <div>
      <p className="text-sm font-bold">Choose your brew device</p>
      <p className="text-xs text-ink-text-faint">Pick the device you&apos;re brewing on.</p>
    </div>
    {brewDevices.length === 0 ? (
      <p className="text-[13px] text-ink-text-dim">
        No brew devices yet. Power on your Pico and pair it from{' '}
        <Link to="/settings" className="font-semibold text-brand-500">
          Settings → Devices
        </Link>
        .
      </p>
    ) : (
      <div className="flex flex-wrap gap-3">
        {brewDevices.map((device) => (
          <DeviceTile key={device.id} device={device} onSelect={() => onChoose(device)} />
        ))}
      </div>
    )}
    <button
      type="button"
      onClick={onManual}
      className="self-start text-xs font-semibold text-brand-500 hover:underline"
    >
      Track a brew manually instead
    </button>
  </Card>
);

const formatElapsed = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

const WaitForDevice: FC<{
  device: DeviceOption;
  recipeName: string;
  sessionId: number;
  onCancel: () => void;
  onBack: () => void;
}> = ({ device, recipeName, sessionId, onCancel, onBack }) => {
  const navigate = useNavigate();
  const fetcher = useFetcher<{ status?: 'waiting' | 'picked' | 'gone' }>();
  const url = `/api/devices/${device.id}/queued-brew?session=${sessionId}`;
  const [elapsed, setElapsed] = useState(0);
  const load = useRef(fetcher.load);
  load.current = fetcher.load;
  const idle = useRef(true);
  idle.current = fetcher.state === 'idle';
  const status = fetcher.data?.status;

  // Poll until the device has picked the queued brew up (its getRecipe call moves the session on).
  useEffect(() => {
    load.current(url);
    const timer = setInterval(() => {
      if (idle.current) {
        load.current(url);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [url]);

  useEffect(() => {
    if (status === 'picked') {
      navigate(`/sessions/${sessionId}`);
    }
  }, [status, sessionId, navigate]);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  if (status === 'gone') {
    return (
      <Card className="max-w-[720px] gap-4 p-[22px]">
        <p className="text-sm font-bold">This brew is no longer queued</p>
        <p className="text-[13px] text-ink-text-dim">
          It was cancelled or expired before {device.name} picked it up. Send it again to try once more.
        </p>
        <Button variant="brand" className="self-start" onClick={onBack}>
          Back
        </Button>
      </Card>
    );
  }

  return (
    <Card className="max-w-[720px] gap-5 p-[22px]">
      <div className="flex items-center gap-3">
        <DeviceTypeIcon kind={iconKindForDevice(device.deviceType, device.metadata)} size={34} color="brand-500" />
        <div>
          <p className="text-sm font-bold">
            Sent to your {device.name}: {recipeName}
          </p>
          <p className="text-xs text-ink-text-faint">This page continues automatically once the device starts.</p>
        </div>
      </div>
      <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[13px] text-ink-text-secondary">
        <li>
          On the device, choose <span className="font-semibold text-ink-text">{recipeName}</span> — it&apos;s the only
          recipe in its list.
        </li>
        <li>Follow the prompts on the device and start the brew.</li>
      </ol>
      {!device.online && (
        <p className="rounded-lg border border-info-500 bg-info-100 px-3.5 py-2.5 text-[13px] font-semibold text-info-500">
          {device.name} looks offline. Power it on and make sure it&apos;s connected to the PicoBrew Wi-Fi network.
        </p>
      )}
      <div className="flex flex-col items-center gap-3 rounded-[10px] bg-ink-bg px-4 py-6 text-center">
        <span className="size-8 shrink-0 animate-spin rounded-full border-[3px] border-brand-500 border-t-transparent" />
        <p className="text-[13px] text-ink-text-dim">Waiting for {device.name} to start the brew…</p>
        <span className="font-mono text-xs text-ink-text-faint">{formatElapsed(elapsed)}</span>
      </div>
      <Button variant="outline" className="self-center" onClick={onCancel}>
        Cancel
      </Button>
    </Card>
  );
};

export const NewSession: FC<NewSessionProps> = ({ recipes, brewDevices, tiltDevices }) => {
  const navigate = useNavigate();
  const navigation = useNavigation();
  const actionData = useActionData<{ error?: string; queuedSessionId?: number; recipeName?: string }>();
  const cancelFetcher = useFetcher();

  const [mode, setMode] = useState<'choose' | 'pico-form' | 'waiting' | 'manual'>('choose');
  const [queued, setQueued] = useState<{ sessionId: number; recipeName: string } | null>(null);
  const [chosen, setChosen] = useState<DeviceOption | null>(null);
  const [recipeId, setRecipeId] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [fermentDeviceId, setFermentDeviceId] = useState('');
  const [carbMethod, setCarbMethod] = useState('Bottle');
  const [carbDuration, setCarbDuration] = useState(2);

  // The Pico flow's form posts intent=queueBrew; once the server has queued the brew, wait for the device.
  useEffect(() => {
    if (actionData?.queuedSessionId) {
      setQueued({ sessionId: actionData.queuedSessionId, recipeName: actionData.recipeName ?? '' });
      setMode('waiting');
    }
  }, [actionData]);

  const cancelQueued = () => {
    if (queued) {
      cancelFetcher.submit({ intent: 'cancelQueuedBrew', sessionId: String(queued.sessionId) }, { method: 'post' });
    }
    setQueued(null);
    setMode('pico-form');
  };

  // The global AI Brewmaster sidekick's "start a new session on <device>" chat action (see
  // AiBrewmasterModal.tsx / api.ai-chat.ts) stashes its device/recipe pick in sessionStorage right
  // before navigating here, since a GET navigation has nowhere else to carry it. Picked up once on
  // mount and pre-selected below — the user still has to review and hit Start Brewing themselves,
  // same "AI drafts, human confirms" pattern used everywhere else in this feature. Re-validated
  // against the lists this page actually loaded, in case the AI (or a stale draft) named something
  // that no longer exists.
  useEffect(() => {
    const raw = sessionStorage.getItem('ai-draft-session');
    if (!raw) {
      return;
    }
    try {
      const draft = JSON.parse(raw) as { deviceId?: number; recipeId?: number };
      if (draft.deviceId != null && brewDevices.some((d) => d.id === draft.deviceId)) {
        setDeviceId(String(draft.deviceId));
        const draftDevice = brewDevices.find((d) => d.id === draft.deviceId) ?? null;
        if (draftDevice && STARTS_ON_DEVICE.includes(draftDevice.deviceType)) {
          setChosen(draftDevice);
          setMode('pico-form');
        } else {
          setMode('manual');
        }
      }
      if (draft.recipeId != null && recipes.some((r) => r.id === draft.recipeId)) {
        setRecipeId(String(draft.recipeId));
        setMode((current) => (current === 'choose' ? 'manual' : current));
      }
    } catch {
      // malformed/foreign draft — ignore rather than half-apply it
    } finally {
      sessionStorage.removeItem('ai-draft-session');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recipe = useMemo(() => recipes.find((r) => r.id === Number(recipeId)) ?? null, [recipes, recipeId]);
  const carbUnit = CARB_METHODS.find((m) => m.label === carbMethod)?.unit ?? 'weeks';

  const brewMinutes = useMemo(() => recipe?.steps.reduce((sum, s) => sum + s.stepTime + s.drainTime, 0) ?? 0, [recipe]);

  const estimate = useMemo(() => {
    const parts: string[] = [];
    if (recipe) {
      parts.push(`${formatMinutes(brewMinutes)} brew`);
    }
    if (recipe?.fermentDays) {
      parts.push(`${recipe.fermentDays}d ferment`);
    }
    parts.push(`${carbDuration}${carbUnit === 'weeks' ? 'w' : 'h'} carb`);
    return parts.join(' + ');
  }, [recipe, brewMinutes, carbDuration, carbUnit]);

  const isSubmitting = navigation.state === 'submitting';

  return (
    <>
      <div className="mb-1 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/sessions')}
          className="flex size-8 items-center justify-center rounded-[7px] border border-ink-card-border bg-ink-card"
        >
          <MdArrowBack className="size-[15px]" />
        </button>
        <p className="text-lg font-bold">New Session</p>
      </div>

      {mode === 'choose' && (
        <ChooseDevice
          brewDevices={brewDevices}
          onChoose={(device) => {
            setChosen(device);
            setDeviceId(String(device.id));
            setMode(STARTS_ON_DEVICE.includes(device.deviceType) ? 'pico-form' : 'manual');
          }}
          onManual={() => setMode('manual')}
        />
      )}
      {mode === 'waiting' && chosen && queued && (
        <WaitForDevice
          device={chosen}
          recipeName={queued.recipeName}
          sessionId={queued.sessionId}
          onCancel={cancelQueued}
          onBack={() => {
            setQueued(null);
            setMode('pico-form');
          }}
        />
      )}
      {(mode === 'manual' || mode === 'pico-form') && (
        <>
          <button
            type="button"
            onClick={() => setMode('choose')}
            className="mb-3 self-start text-xs font-semibold text-brand-500 hover:underline"
          >
            ← Choose a different device
          </button>
          <Form method="post">
            {mode === 'pico-form' && <input type="hidden" name="intent" value="queueBrew" />}
            <div className="flex max-w-[720px] flex-col gap-4">
              <Card className="gap-4 p-[22px]">
                <p className="text-sm font-bold">Recipe</p>
                <Select
                  name="recipeId"
                  placeholder="Select a recipe"
                  value={recipeId}
                  onChange={(e) => setRecipeId(e.target.value)}
                >
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} — {r.style || 'Unspecified style'}
                    </option>
                  ))}
                </Select>

                {recipe && (
                  <div className="flex items-center gap-3.5 rounded-[10px] bg-ink-bg p-3">
                    <img
                      src={recipe.photoUrl || srmSwatchUrl(recipe.colorSRM) || '/img/no-photo.jpg'}
                      alt={recipe.name}
                      className="size-14 shrink-0 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{recipe.name}</p>
                      <p className="mb-1.5 text-xs text-ink-text-faint">{recipe.style || 'Unspecified style'}</p>
                      <div className="flex gap-[18px] text-[11px] text-ink-text-secondary">
                        {recipe.abv >= 0 && (
                          <div>
                            <p className="text-ink-text-faint">ABV</p>
                            <p className="font-bold">{formatAbv(recipe.abv, { unit: false })}</p>
                          </div>
                        )}
                        {recipe.ibu >= 0 && (
                          <div>
                            <p className="text-ink-text-faint">IBU</p>
                            <p className="font-bold">{formatIbu(recipe.ibu, { unit: false })}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-ink-text-faint">Est. Brew Time</p>
                          <p className="font-bold">{formatMinutes(brewMinutes)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Card>

              <Card className="gap-4 p-[22px]">
                <p className="text-sm font-bold">Devices</p>
                <div className="flex flex-wrap gap-4">
                  {mode === 'pico-form' && chosen ? (
                    <div className="min-w-[220px] flex-1">
                      <Label className="mb-1.5 block text-[11px] font-semibold text-ink-text-secondary">
                        Brew Device
                      </Label>
                      <div className="flex items-center gap-2.5 rounded-lg border border-ink-divider bg-ink-bg px-3.5 py-2.5">
                        <DeviceTypeIcon
                          kind={iconKindForDevice(chosen.deviceType, chosen.metadata)}
                          size={22}
                          color="ink-text-secondary"
                        />
                        <span className="text-[13px] font-semibold">{chosen.name}</span>
                      </div>
                      <input type="hidden" name="deviceId" value={chosen.id} />
                    </div>
                  ) : (
                    <div className="min-w-[220px] flex-1">
                      <Label className="mb-1.5 block text-[11px] font-semibold text-ink-text-secondary">
                        Brew Device *
                      </Label>
                      <Select
                        name="deviceId"
                        placeholder="Select a device"
                        value={deviceId}
                        onChange={(e) => setDeviceId(e.target.value)}
                      >
                        {brewDevices.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                  <div className="min-w-[220px] flex-1">
                    <Label className="mb-1.5 block text-[11px] font-semibold text-ink-text-secondary">
                      Ferment Device (optional)
                    </Label>
                    <Select
                      name="fermentDeviceId"
                      value={fermentDeviceId}
                      onChange={(e) => setFermentDeviceId(e.target.value)}
                    >
                      <option value="">None — manual tracking</option>
                      {tiltDevices.map((d) => (
                        <option key={d.id} value={d.id}>
                          Tilt · {d.color || d.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </Card>

              <Card className="gap-3.5 p-[22px]">
                <div>
                  <p className="text-sm font-bold">Carbonation</p>
                  <p className="text-xs text-ink-text-faint">
                    Manual step — no sensor tracking. Choose method and how long.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {CARB_METHODS.map((m) => (
                    <button
                      key={m.label}
                      type="button"
                      onClick={() => setCarbMethod(m.label)}
                      className={cn(
                        'rounded-lg border px-3.5 py-2.5 text-[13px] font-semibold',
                        carbMethod === m.label
                          ? 'border-brand-500 bg-brand-100 text-ink-text'
                          : 'border-ink-divider bg-ink-bg text-ink-text-secondary',
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <input type="hidden" name="carbMethod" value={carbMethod} />
                <div className="max-w-[200px]">
                  <Label className="mb-1.5 block text-[11px] font-semibold text-ink-text-secondary">
                    Duration ({carbUnit})
                  </Label>
                  <Input
                    type="number"
                    name="carbDuration"
                    value={carbDuration}
                    onChange={(e) => setCarbDuration(Number(e.target.value))}
                    min={1}
                    className="font-mono"
                  />
                </div>
              </Card>

              {actionData?.error && <p className="text-[13px] text-danger-500">{actionData.error}</p>}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold tracking-[0.5px] text-ink-text-faint">ESTIMATED TOTAL TIME</p>
                  <p className="font-mono text-sm font-bold">{estimate}</p>
                </div>
                <Button type="submit" variant="brand" disabled={!recipeId || !deviceId || isSubmitting}>
                  {mode === 'pico-form'
                    ? isSubmitting
                      ? 'Sending…'
                      : `Send to ${chosen?.name ?? 'device'}`
                    : isSubmitting
                    ? 'Starting…'
                    : 'Start Brewing'}
                </Button>
              </div>
            </div>
          </Form>
        </>
      )}
    </>
  );
};

export default NewSession;
