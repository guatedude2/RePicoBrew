import { useFetcher, useLoaderData, Link } from 'react-router';
import { useEffect, useState, type FC } from 'react';
import { MdCheckCircle, MdOutlineRemoveRedEye, MdRefresh } from 'react-icons/md';
import { RiEyeCloseLine } from 'react-icons/ri';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { DevicesCard } from '~/components/settings/DevicesCard';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { WifiNetworkPicker } from '~/components/WifiNetworkPicker';
import { cn } from '~/lib/utils';

const STEPS = ['welcome', 'admin', 'hostname', 'ap', 'wifi', 'devices'] as const;
type Step = (typeof STEPS)[number];

const Logo: FC = () => (
  <div className="mb-8 flex items-center justify-center gap-2.5">
    <div className="flex size-9 items-center justify-center rounded-[9px] bg-gradient-to-br from-brand-300 to-brand-600">
      <svg viewBox="0 0 24 24" className="size-[19px] text-ink-on-brand">
        <path d="M6 3h10l1 4H5l1-4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path
          d="M5 7h14l-1.4 12.2A2 2 0 0 1 15.6 21H8.4a2 2 0 0 1-2-1.8L5 7z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
    <div className="leading-[1.1]">
      <p className="text-base font-bold tracking-[0.5px]">REPICOBREW</p>
      <p className="text-[11px] tracking-[1px] text-ink-text-faint">CONTROL DECK</p>
    </div>
  </div>
);

const ProgressDots: FC<{ currentIndex: number }> = ({ currentIndex }) => (
  <div className="mb-6 flex gap-1.5">
    {STEPS.map((step, index) => (
      <div
        key={step}
        className={cn(
          'h-1 flex-1 rounded-full transition-colors',
          index < currentIndex ? 'bg-success-500' : index === currentIndex ? 'bg-brand-500' : 'bg-ink-divider',
        )}
      />
    ))}
  </div>
);

const FieldLabel: FC<{ htmlFor?: string; children: React.ReactNode }> = ({ htmlFor, children }) => (
  <Label htmlFor={htmlFor} className="mb-1.5 block">
    {children}
  </Label>
);

// A word-based passphrase (e.g. "hoppy-barley-42") is easier to read off a screen and type into a
// device's Wi-Fi settings than a random-character string, while still comfortably clearing WPA2's
// 8-character minimum.
const PASSPHRASE_WORDS = [
  'hoppy',
  'malty',
  'barley',
  'yeasty',
  'amber',
  'stout',
  'porter',
  'kettle',
  'mash',
  'cask',
  'lager',
  'krausen',
  'copper',
  'toasty',
  'wort',
  'pilsner',
];

function generatePassphrase(): string {
  const pick = () => PASSPHRASE_WORDS[Math.floor(Math.random() * PASSPHRASE_WORDS.length)];
  const suffix = Math.floor(10 + Math.random() * 90);
  return `${pick()}-${pick()}-${suffix}`;
}

const RpiOnlyHint: FC = () => (
  <p className="mt-1.5 text-xs text-ink-text-faint">
    These settings only take effect on a Raspberry Pi — safe to fill in now either way.
  </p>
);

export const Setup: FC = () => {
  const { devices, discoveredDevices, nearbyNetworks, isRpi } = useLoaderData<typeof import('~/routes/setup').loader>();
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [hostname, setHostname] = useState('repicobrew-01');
  const [apName, setApName] = useState('RePicoBrew');
  const [apPassword, setApPassword] = useState(() => generatePassphrase());
  const [showApPassword, setShowApPassword] = useState(true);
  const [wifiName, setWifiName] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [manualWifiEntry, setManualWifiEntry] = useState(false);

  const setupFetcher = useFetcher<{ success?: boolean; error?: string }>();
  const isApplying = setupFetcher.state !== 'idle';
  const [showFinish, setShowFinish] = useState(false);

  useEffect(() => {
    if (setupFetcher.state === 'idle' && setupFetcher.data?.success) {
      setShowFinish(true);
    }
  }, [setupFetcher.state, setupFetcher.data]);

  const passwordTooShort = password.length > 0 && password.length < 8;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const isStepValid: Record<Step, boolean> = {
    welcome: true,
    admin: !!name.trim() && /\S+@\S+\.\S+/.test(email) && password.length >= 8 && password === confirmPassword,
    hostname: !!hostname.trim(),
    ap: !!apName.trim() && !!apPassword.trim(),
    wifi: !!wifiName.trim() && !!wifiPassword.trim(),
    devices: true,
  };

  const goNext = () => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0));

  const handleFinishSetup = () => {
    setupFetcher.submit(
      {
        intent: 'complete-setup',
        name,
        email,
        password,
        confirmPassword,
        hostname,
        apName,
        apPassword,
        wifiName,
        wifiPassword,
      },
      { method: 'post' },
    );
  };

  if (showFinish) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-ink-bg p-6">
        <Card className="flex w-full max-w-[520px] flex-col items-center gap-5 p-8 text-center">
          <Logo />
          <MdCheckCircle className="size-14 text-success-500" />
          <div>
            <p className="text-2xl font-bold">You&apos;re all set</p>
            <p className="mt-2 text-sm text-ink-text-dim">
              <span className="font-mono">{hostname}.local</span> is online and connected to{' '}
              <span className="font-semibold">{wifiName}</span>. Start your first brew whenever you&apos;re ready.
            </p>
          </div>
          <Link to="/" className="w-full">
            <Button variant="brand" size="lg" className="w-full">
              Go to Dashboard
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-ink-bg p-6">
      <div className="w-full max-w-[520px]">
        <Logo />
        <Card className="flex w-full flex-col gap-5 p-8">
          <ProgressDots currentIndex={stepIndex} />

          {isApplying ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="size-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              <p className="font-semibold">Applying settings &amp; restarting…</p>
              <p className="text-xs text-ink-text-faint">This can take up to a minute. Don&apos;t unplug the device.</p>
            </div>
          ) : (
            <>
              {setupFetcher.data?.error ? <p className="text-sm text-danger-500">{setupFetcher.data.error}</p> : null}

              {step === 'welcome' && (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-300 to-brand-600">
                    <svg viewBox="0 0 24 24" className="size-7 text-ink-on-brand">
                      <path
                        d="M6 3h10l1 4H5l1-4z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M5 7h14l-1.4 12.2A2 2 0 0 1 15.6 21H8.4a2 2 0 0 1-2-1.8L5 7z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <p className="text-2xl font-bold">Welcome to RePicoBrew</p>
                  <p className="text-sm text-ink-text-dim">
                    Let&apos;s get your control deck set up. This takes about 3 minutes: create an admin account, name
                    this device, and connect it to your network.
                  </p>
                </div>
              )}

              {step === 'admin' && (
                <div className="flex flex-col gap-3.5">
                  <div>
                    <p className="text-[17px] font-bold">Create admin account</p>
                    <p className="mt-1 text-[13px] text-ink-text-dim">
                      This account manages devices, recipes, and other users.
                    </p>
                  </div>
                  <div>
                    <FieldLabel htmlFor="setup-name">Full Name</FieldLabel>
                    <Input
                      id="setup-name"
                      placeholder="Jordan Avery"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="setup-email">Email</FieldLabel>
                    <Input
                      id="setup-email"
                      type="email"
                      placeholder="jordan@repicobrew.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="setup-password">Password</FieldLabel>
                    <div className="relative">
                      <Input
                        id="setup-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="At least 8 characters"
                        className="pr-10"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute inset-y-0 right-3 flex items-center text-ink-text-faint"
                      >
                        {showPassword ? (
                          <RiEyeCloseLine className="size-4" />
                        ) : (
                          <MdOutlineRemoveRedEye className="size-4" />
                        )}
                      </button>
                    </div>
                    {passwordTooShort && (
                      <p className="mt-1.5 text-xs text-danger-500">Must be at least 8 characters.</p>
                    )}
                  </div>
                  <div>
                    <FieldLabel htmlFor="setup-confirm-password">Confirm Password</FieldLabel>
                    <Input
                      id="setup-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    {passwordsMismatch && <p className="mt-1.5 text-xs text-danger-500">Passwords don&apos;t match.</p>}
                  </div>
                </div>
              )}

              {step === 'hostname' && (
                <div className="flex flex-col gap-3.5">
                  <div>
                    <p className="text-[17px] font-bold">Name this device</p>
                    <p className="mt-1 text-[13px] text-ink-text-dim">
                      This is how it will appear on your network and in the app.
                    </p>
                  </div>
                  <div>
                    <FieldLabel htmlFor="setup-hostname">Hostname</FieldLabel>
                    <Input
                      id="setup-hostname"
                      className="font-mono"
                      placeholder="repicobrew-01"
                      value={hostname}
                      onKeyDown={(event) => (/[^\w.-]/.test(event.key) ? event.preventDefault() : null)}
                      onChange={(e) => setHostname(e.target.value)}
                    />
                    <p className="mt-1.5 font-mono text-xs text-ink-text-faint">Reachable at {hostname || '…'}.local</p>
                    {!isRpi && <RpiOnlyHint />}
                  </div>
                </div>
              )}

              {step === 'ap' && (
                <div className="flex flex-col gap-3.5">
                  <div>
                    <p className="text-[17px] font-bold">Access Point</p>
                    <p className="mt-1 text-[13px] text-ink-text-dim">
                      Broadcasts the network for your Picobrew devices to connect to.
                    </p>
                  </div>
                  <div>
                    <FieldLabel htmlFor="setup-ap-name">AP Network Name</FieldLabel>
                    <Input id="setup-ap-name" value={apName} onChange={(e) => setApName(e.target.value)} />
                  </div>
                  <div>
                    <FieldLabel htmlFor="setup-ap-password">AP Password</FieldLabel>
                    <div className="relative">
                      <Input
                        id="setup-ap-password"
                        type={showApPassword ? 'text' : 'password'}
                        className="pr-[68px] font-mono"
                        value={apPassword}
                        onChange={(e) => setApPassword(e.target.value)}
                      />
                      <div className="absolute inset-y-0 right-2 flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="Generate a new password"
                          onClick={() => setApPassword(generatePassphrase())}
                          className="flex size-7 items-center justify-center text-ink-text-faint hover:text-ink-text-secondary"
                        >
                          <MdRefresh className="size-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={showApPassword ? 'Hide password' : 'Show password'}
                          onClick={() => setShowApPassword((v) => !v)}
                          className="flex size-7 items-center justify-center text-ink-text-faint hover:text-ink-text-secondary"
                        >
                          {showApPassword ? (
                            <RiEyeCloseLine className="size-4" />
                          ) : (
                            <MdOutlineRemoveRedEye className="size-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <p className="mt-1.5 text-xs text-ink-text-faint">
                      Generated for you — easy to read off a screen. Feel free to change it.
                    </p>
                    {!isRpi && <RpiOnlyHint />}
                  </div>
                </div>
              )}

              {step === 'wifi' && (
                <div className="flex flex-col gap-3.5">
                  <div>
                    <p className="text-[17px] font-bold">Wi-Fi</p>
                    <p className="mt-1 text-[13px] text-ink-text-dim">
                      Upstream network connecting this device to your router and the internet.
                    </p>
                  </div>
                  <div>
                    <FieldLabel htmlFor="setup-wifi-name">Network Name</FieldLabel>
                    <WifiNetworkPicker
                      networks={nearbyNetworks}
                      selectedSsid={wifiName}
                      onSelect={setWifiName}
                      manualMode={manualWifiEntry}
                      onEnterManually={() => setManualWifiEntry(true)}
                      manualValue={wifiName}
                      onManualChange={setWifiName}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="setup-wifi-password">Password</FieldLabel>
                    <Input
                      id="setup-wifi-password"
                      type="password"
                      value={wifiPassword}
                      onChange={(e) => setWifiPassword(e.target.value)}
                    />
                    {!isRpi && <RpiOnlyHint />}
                  </div>
                </div>
              )}

              {step === 'devices' && (
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="text-[17px] font-bold">Add your devices</p>
                    <p className="mt-1 text-[13px] text-ink-text-dim">
                      Pair each device to give it a name. You can skip this and add devices later from Settings.
                    </p>
                  </div>
                  <DevicesCard devices={devices} discoveredDevices={discoveredDevices} />
                </div>
              )}

              <div className="mt-2 flex items-center justify-between">
                {stepIndex > 0 ? (
                  <Button variant="outline" onClick={goBack}>
                    Back
                  </Button>
                ) : (
                  <span />
                )}
                {step === 'devices' ? (
                  <Button variant="brand" disabled={isApplying} onClick={handleFinishSetup}>
                    Finish Setup
                  </Button>
                ) : (
                  <Button variant="brand" disabled={!isStepValid[step]} onClick={goNext}>
                    Continue
                  </Button>
                )}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};
