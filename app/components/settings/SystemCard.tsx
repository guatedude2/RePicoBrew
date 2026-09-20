import { useFetcher } from 'react-router';
import { useEffect, useState, type FC } from 'react';
import { createPortal } from 'react-dom';
import {
  MdCheckCircle,
  MdInfoOutline,
  MdPowerOff,
  MdPowerSettingsNew,
  MdRestartAlt,
  MdSystemUpdateAlt,
} from 'react-icons/md';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import type { NetworkAddress, OsRelease } from '~/utils/system-info.server';

export type SystemInfo = {
  hostname: string;
  ipAddresses: NetworkAddress[];
  appVersion: string;
  osRelease: OsRelease | null;
};

interface SystemCardProps {
  systemInfo: SystemInfo;
  isRpi: boolean;
  canControlSystem: boolean;
}

const InfoRow: FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-start justify-between gap-4 border-t border-ink-divider px-4 py-3 text-[13px] first:border-t-0">
    <p className="flex-none text-ink-text-faint">{label}</p>
    <p className="text-right font-semibold text-ink-text">{value}</p>
  </div>
);

// Restart / reboot / shutdown all take the app (or the whole Pi) away mid-request, so the click can't
// just wait for a response: once confirmed, a full-screen overlay (PowerOverlay) takes over and works
// out what's happening by probing the server itself. A failure that does come back as a normal
// response (e.g. this isn't a Pi, or the sudoers rule isn't installed) closes the overlay and shows
// the error under the button instead.
type ActionState = 'idle' | 'confirming' | 'running';
type PowerKind = 'restart' | 'reboot' | 'shutdown';

const POWER_KIND: Record<'restartServer' | 'rebootPi' | 'shutdownPi', PowerKind> = {
  restartServer: 'restart',
  rebootPi: 'reboot',
  shutdownPi: 'shutdown',
};

// How long to wait before trusting an "up" answer, and after which to stop insisting we saw the
// server go down first (a fast restart can come and go between two probes). A 5xx from nginx while
// the app is down counts as down.
const RETURN_TIMING: Record<'restart' | 'reboot', { minWaitMs: number; fallbackMs: number }> = {
  restart: { minWaitMs: 4_000, fallbackMs: 25_000 },
  reboot: { minWaitMs: 15_000, fallbackMs: 120_000 },
};
const GIVE_UP_MS = 5 * 60_000;
const PROBE_INTERVAL_MS = 2_000;

async function serverIsUp(): Promise<boolean> {
  try {
    const response = await fetch(`/favicon.ico?t=${Date.now()}`, { cache: 'no-store' });
    return response.status < 500;
  } catch {
    return false;
  }
}

const OVERLAY_TITLE: Record<PowerKind, string> = {
  restart: 'Restarting the server…',
  reboot: 'Rebooting the system…',
  shutdown: 'Shutting down…',
};

const PowerOverlay: FC<{ kind: PowerKind }> = ({ kind }) => {
  const [phase, setPhase] = useState<'working' | 'off' | 'slow'>('working');

  useEffect(() => {
    let cancelled = false;
    let sawDown = false;
    let consecutiveDown = 0;
    const startedAt = Date.now();

    const tick = async () => {
      const up = await serverIsUp();
      if (cancelled) {
        return;
      }
      const elapsed = Date.now() - startedAt;
      if (kind === 'shutdown') {
        consecutiveDown = up ? 0 : consecutiveDown + 1;
        if (consecutiveDown >= 3) {
          setPhase('off');
          return;
        }
      } else {
        const { minWaitMs, fallbackMs } = RETURN_TIMING[kind];
        sawDown = sawDown || !up;
        if (up && elapsed > minWaitMs && (sawDown || elapsed > fallbackMs)) {
          window.location.reload();
          return;
        }
      }
      if (elapsed > GIVE_UP_MS) {
        setPhase('slow');
        return;
      }
      setTimeout(tick, PROBE_INTERVAL_MS);
    };
    const first = setTimeout(tick, PROBE_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(first);
    };
  }, [kind]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-bg p-6">
      <div className="flex max-w-[420px] flex-col items-center gap-4 text-center">
        {phase === 'off' ? (
          <>
            <MdPowerOff className="size-14 text-success-500" />
            <p className="text-2xl font-bold">You can now turn off the system</p>
            <p className="text-sm text-ink-text-dim">
              The Raspberry Pi has shut down. Once its green light stops blinking it&apos;s safe to unplug the power.
              Plug it back in to turn it on again.
            </p>
          </>
        ) : phase === 'slow' ? (
          <>
            <MdInfoOutline className="size-14 text-info-500" />
            <p className="text-2xl font-bold">This is taking longer than expected</p>
            <p className="text-sm text-ink-text-dim">
              {kind === 'shutdown'
                ? 'The device still seems to be responding. Check that it has actually powered down before unplugging it.'
                : "The server hasn't come back yet. Give it a little longer, then reload the page."}
            </p>
            <Button variant="brand" onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </>
        ) : (
          <>
            <div className="size-10 animate-spin rounded-full border-[3px] border-brand-500 border-t-transparent" />
            <p className="text-2xl font-bold">{OVERLAY_TITLE[kind]}</p>
            <p className="text-sm text-ink-text-dim">
              Please wait.{' '}
              {kind === 'shutdown'
                ? "Don't unplug the device yet."
                : "This page will reload by itself when it's back — don't unplug the device."}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

const ActionButton: FC<{
  label: string;
  confirmTitle: string;
  confirmDescription: string;
  confirmLabel: string;
  variant: 'outline' | 'danger';
  icon: React.ReactNode;
  intent: 'restartServer' | 'rebootPi' | 'shutdownPi';
}> = ({ label, confirmTitle, confirmDescription, confirmLabel, variant, icon, intent }) => {
  const fetcher = useFetcher<{ error?: string }>();
  const [state, setState] = useState<ActionState>('idle');

  const run = () => {
    setState('running');
    fetcher.submit({ intent }, { method: 'post' });
  };

  // A failure (e.g. this isn't really a Pi, or the sudoers rule isn't installed) comes back as a
  // normal fetcher response instead of a dropped connection — close the overlay and show it.
  useEffect(() => {
    if (fetcher.data?.error && state === 'running') {
      setState('idle');
    }
  }, [fetcher.data, state]);

  return (
    <>
      <Button
        variant={variant === 'danger' ? 'danger' : 'outline'}
        disabled={state === 'running'}
        onClick={() => setState('confirming')}
      >
        {icon}
        {label}
      </Button>
      {fetcher.data?.error ? <p className="mt-2 text-xs text-danger-500">{fetcher.data.error}</p> : null}

      <Dialog open={state === 'confirming'} onOpenChange={(open) => !open && setState('idle')}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmTitle}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-ink-text-secondary">{confirmDescription}</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setState('idle')}>
              Cancel
            </Button>
            <Button variant={variant === 'danger' ? 'danger' : 'brand'} onClick={run}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {state === 'running' ? createPortal(<PowerOverlay kind={POWER_KIND[intent]} />, document.body) : null}
    </>
  );
};

type PendingUpdate = { name: string; from: string; to: string };
type UpdatesResponse = {
  success?: boolean;
  error?: string;
  updates?: PendingUpdate[];
  status?: { state: 'idle' | 'running' | 'succeeded' | 'failed'; log: string; rebootRequired: boolean };
};

const MAX_LISTED_UPDATES = 8;

// "Check" refreshes apt's package lists and lists what's upgradable; "Update" starts the upgrade as a
// detached systemd unit on the Pi (it can take many minutes, so it can't ride on a web request) and
// this card polls its status until it finishes. See app/utils/system-control.server.ts.
const UpdatesCard: FC<{ isRpi: boolean; canControlSystem: boolean }> = ({ isRpi, canControlSystem }) => {
  const checkFetcher = useFetcher<UpdatesResponse>();
  const applyFetcher = useFetcher<UpdatesResponse>();
  const statusFetcher = useFetcher<UpdatesResponse>();
  const [confirming, setConfirming] = useState(false);
  const [applying, setApplying] = useState(false);

  const checking = checkFetcher.state !== 'idle';
  const updates = checkFetcher.data?.updates;
  const status = statusFetcher.data?.status;
  const applyError = applyFetcher.data?.error;

  const check = () => checkFetcher.submit({ intent: 'checkUpdates' }, { method: 'post' });
  const apply = () => {
    setConfirming(false);
    setApplying(true);
    applyFetcher.submit({ intent: 'applyUpdates' }, { method: 'post' });
  };

  const pollStatus = statusFetcher.submit;
  useEffect(() => {
    if (!applying) {
      return;
    }
    const timer = setInterval(() => pollStatus({ intent: 'updateStatus' }, { method: 'post' }), 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applying]);

  useEffect(() => {
    // Right after starting, a poll can still say "idle" before the unit exists — only a finished
    // state (or the start itself failing) ends the wait.
    if (applying && (status?.state === 'succeeded' || status?.state === 'failed' || applyError)) {
      setApplying(false);
    }
  }, [applying, status?.state, applyError]);

  return (
    <Card className="p-6">
      <p className="mb-1 text-[17px] font-bold">Software Updates</p>
      <p className="mb-3.5 text-[13px] leading-relaxed text-ink-text-dim">
        Checks the operating system&apos;s package sources for updates and installs them. Needs an internet connection;
        installing can take several minutes and may need a reboot afterwards.
      </p>
      {!isRpi && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-info-500 bg-info-100 px-3.5 py-2.5 text-[13px] font-semibold text-info-500">
          <MdInfoOutline className="size-4 shrink-0" />
          This server isn&apos;t running on a Raspberry Pi, so these actions will fail here — that&apos;s expected on a
          dev machine.
        </div>
      )}
      {!canControlSystem ? (
        <p className="text-[13px] text-ink-text-faint">Your account doesn&apos;t have permission to do this.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" disabled={checking || applying} onClick={check}>
              <MdSystemUpdateAlt className="size-4" />
              {checking ? 'Checking…' : 'Check for updates'}
            </Button>
            {updates && updates.length > 0 && !applying ? (
              <Button variant="brand" onClick={() => setConfirming(true)}>
                Update {updates.length} package{updates.length === 1 ? '' : 's'}
              </Button>
            ) : null}
          </div>

          {checking ? (
            <p className="flex items-center gap-2 text-[13px] text-ink-text-dim">
              <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              Refreshing package lists… this can take a minute or two.
            </p>
          ) : null}
          {checkFetcher.data?.error ? <p className="text-[13px] text-danger-500">{checkFetcher.data.error}</p> : null}
          {applyError ? <p className="text-[13px] text-danger-500">{applyError}</p> : null}

          {updates && !checking && updates.length === 0 ? (
            <p className="flex items-center gap-2 text-[13px] text-success-500">
              <MdCheckCircle className="size-4 shrink-0" />
              Your system is up to date.
            </p>
          ) : null}
          {updates && !checking && updates.length > 0 ? (
            <div className="flex flex-col overflow-hidden rounded-[10px] border border-ink-divider">
              {updates.slice(0, MAX_LISTED_UPDATES).map((update) => (
                <InfoRow key={update.name} label={update.name} value={update.to} />
              ))}
              {updates.length > MAX_LISTED_UPDATES ? (
                <InfoRow label={`…and ${updates.length - MAX_LISTED_UPDATES} more`} value="" />
              ) : null}
            </div>
          ) : null}

          {applying ? (
            <div className="flex flex-col gap-1.5">
              <p className="flex items-center gap-2 text-[13px] text-ink-text-dim">
                <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                Installing updates… this can take several minutes. Don&apos;t unplug the device.
              </p>
              {status?.log ? (
                <pre className="max-h-32 overflow-auto rounded-lg bg-ink-bg p-3 text-[11px] text-ink-text-faint">
                  {status.log}
                </pre>
              ) : null}
            </div>
          ) : null}
          {!applying && status?.state === 'succeeded' ? (
            <p className="flex items-center gap-2 text-[13px] text-success-500">
              <MdCheckCircle className="size-4 shrink-0" />
              Updates installed.{status.rebootRequired ? ' A reboot is needed to finish applying them.' : ''}
            </p>
          ) : null}
          {!applying && status?.state === 'failed' ? (
            <p className="text-[13px] text-danger-500">
              The update did not complete.{status.log ? ` Last output: ${status.log.split('\n').pop()}` : ''}
            </p>
          ) : null}
        </div>
      )}

      <Dialog open={confirming} onOpenChange={(open) => !open && setConfirming(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Install {updates?.length ?? 0} updates?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-ink-text-secondary">
            This upgrades system packages on the Pi and can take several minutes. Services may restart during the
            upgrade, so don&apos;t start it in the middle of a brew, and don&apos;t unplug the device until it finishes.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button variant="brand" onClick={apply}>
              Install Updates
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export const SystemCard: FC<SystemCardProps> = ({ systemInfo, isRpi, canControlSystem }) => {
  const ipAddressList =
    systemInfo.ipAddresses.length > 0
      ? systemInfo.ipAddresses.map((addr) => `${addr.address} (${addr.interfaceName})`).join(', ')
      : 'None detected';

  const osLabel = systemInfo.osRelease
    ? systemInfo.osRelease.PRETTY_NAME ?? systemInfo.osRelease.NAME ?? 'Unknown'
    : 'Unknown (not running on Linux)';

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-6">
        <p className="mb-3.5 text-[17px] font-bold">Server Information</p>
        <div className="flex flex-col overflow-hidden rounded-[10px] border border-ink-divider">
          <InfoRow label="Hostname" value={systemInfo.hostname} />
          <InfoRow label="IP Address(es)" value={ipAddressList} />
          <InfoRow label="Server Version" value={systemInfo.appVersion} />
          <InfoRow label="OS" value={osLabel} />
          {systemInfo.osRelease?.VERSION ? <InfoRow label="OS Version" value={systemInfo.osRelease.VERSION} /> : null}
        </div>
      </Card>

      <Card className="p-6">
        <p className="mb-1 text-[17px] font-bold">Power &amp; Maintenance</p>
        <p className="mb-3.5 text-[13px] leading-relaxed text-ink-text-dim">
          Restart just the RePicoBrew server process, reboot the whole Raspberry Pi, or shut it down. All of these
          interrupt any brewing session currently in progress.
        </p>
        {!isRpi && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-info-500 bg-info-100 px-3.5 py-2.5 text-[13px] font-semibold text-info-500">
            <MdInfoOutline className="size-4 shrink-0" />
            This server isn&apos;t running on a Raspberry Pi, so these actions will fail here — that&apos;s expected on
            a dev machine.
          </div>
        )}
        {!canControlSystem ? (
          <p className="text-[13px] text-ink-text-faint">Your account doesn&apos;t have permission to do this.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            <ActionButton
              intent="restartServer"
              label="Restart Server"
              confirmTitle="Restart the RePicoBrew server?"
              confirmDescription="This restarts the repicobrew service. The app will be briefly unreachable and this page will need a manual refresh once it's back."
              confirmLabel="Restart Server"
              variant="outline"
              icon={<MdRestartAlt className="size-4" />}
            />
            <ActionButton
              intent="rebootPi"
              label="Reboot Pi"
              confirmTitle="Reboot this Raspberry Pi?"
              confirmDescription="This reboots the entire device, not just the app. It will be unreachable for a minute or more while it restarts, and any brewing session in progress will be interrupted."
              confirmLabel="Reboot Pi"
              variant="danger"
              icon={<MdPowerSettingsNew className="size-4" />}
            />
            <ActionButton
              intent="shutdownPi"
              label="Shut Down"
              confirmTitle="Shut down this Raspberry Pi?"
              confirmDescription="This powers the device off. It will not come back until you unplug and replug its power, and any brewing session in progress will be interrupted."
              confirmLabel="Shut Down"
              variant="danger"
              icon={<MdPowerOff className="size-4" />}
            />
          </div>
        )}
      </Card>

      <UpdatesCard isRpi={isRpi} canControlSystem={canControlSystem} />
    </div>
  );
};
