import { useFetcher } from 'react-router';
import { useEffect, useState, type FC } from 'react';
import { MdCheck } from 'react-icons/md';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { cn } from '~/lib/utils';

const METHODS = [
  { label: 'Bottle', unit: 'weeks' },
  { label: 'Keg', unit: 'weeks' },
  { label: 'Forced (CO2)', unit: 'hours' },
];

const RING_COLOR = 'oklch(0.75 0.13 100)';
export const FERM_RING_COLOR = 'oklch(0.78 0.135 65)';

export type CarbonationData = {
  batchId: number;
  carbMethod: string | null;
  carbDuration: number | null;
  carbUnit: string | null;
  carbStartedAt: Date | string | null;
  carbStatus: string | null;
  carbExtendMinutes: number | null;
  isCompleted: boolean;
};

const msFor = (duration: number, unit: string) =>
  unit === 'weeks' ? duration * 7 * 24 * 60 * 60 * 1000 : duration * 60 * 60 * 1000;

export const Ring: FC<{ percent: number; label: string; color?: string }> = ({
  percent,
  label,
  color = RING_COLOR,
}) => (
  <div
    className="relative flex size-24 flex-none items-center justify-center rounded-full"
    style={{ background: `conic-gradient(${color} ${percent}%, oklch(0.26 0.008 260) 0)` }}
  >
    <div className="flex size-[78px] flex-col items-center justify-center rounded-full bg-ink-card">
      <p className="font-mono text-lg font-bold">{percent}%</p>
      <p className="text-[9px] text-ink-text-faint">{label}</p>
    </div>
  </div>
);

// Picks a carbonation method + duration and kicks off the countdown — the normal path is from
// the Bottling step, but it also serves as a fallback inside Carbonation for any batch that
// reached that phase without going through Bottling (e.g. data seeded before Bottling existed).
export const CarbonationSetupForm: FC<{
  batchId: number;
  initialMethod?: string | null;
  initialDuration?: number | null;
}> = ({ batchId, initialMethod, initialDuration }) => {
  const fetcher = useFetcher();
  const [method, setMethod] = useState(initialMethod ?? 'Bottle');
  const [duration, setDuration] = useState(initialDuration ?? 2);
  const unit = METHODS.find((m) => m.label === method)?.unit ?? 'weeks';

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap gap-2.5">
        {METHODS.map((m) => (
          <button
            key={m.label}
            type="button"
            onClick={() => setMethod(m.label)}
            className={cn(
              'min-w-[120px] flex-1 rounded-[10px] border px-4 py-3.5 text-sm font-bold',
              method === m.label
                ? 'border-brand-500 bg-brand-100 text-ink-text'
                : 'border-ink-divider bg-ink-bg text-ink-text-secondary',
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <p className="mb-1.5 text-[11px] font-semibold text-ink-text-secondary">Duration ({unit})</p>
          <Input
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-[100px] font-mono"
          />
        </div>
        <Button
          variant="brand"
          disabled={fetcher.state !== 'idle'}
          onClick={() =>
            fetcher.submit(JSON.stringify({ intent: 'startCarbonation', method, duration, unit }), {
              method: 'post',
              action: `/api/batches/${batchId}`,
              encType: 'application/json',
            })
          }
        >
          {fetcher.state !== 'idle' ? 'Starting…' : 'Start Carbonating'}
        </Button>
      </div>
    </div>
  );
};

export const CarbonationSection: FC<{ data: CarbonationData }> = ({ data }) => {
  const fetcher = useFetcher();
  const [extendAmount, setExtendAmount] = useState(1);
  const [stage, setStage] = useState<'counting' | 'extend'>('counting');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (data.carbStatus !== 'counting') {
      return;
    }
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [data.carbStatus]);

  const submit = (body: Record<string, unknown>) => {
    fetcher.submit(JSON.stringify(body), {
      method: 'post',
      action: `/api/batches/${data.batchId}`,
      encType: 'application/json',
    });
  };

  if (data.isCompleted || data.carbStatus === 'finished') {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-success-100">
          <MdCheck className="size-5 text-success-500" />
        </div>
        <p className="text-sm font-bold">Carbonation complete</p>
        <p className="text-xs text-ink-text-faint">{data.carbMethod ?? 'Batch'} · session finished</p>
      </div>
    );
  }

  if (!data.carbStatus || data.carbStatus === 'setup') {
    return (
      <div className="flex flex-col gap-3.5">
        <p className="text-xs text-ink-text-secondary">
          This step has no sensor tracking — it&apos;s manual. Choose a method and how long, then start.
        </p>
        <CarbonationSetupForm
          batchId={data.batchId}
          initialMethod={data.carbMethod}
          initialDuration={data.carbDuration}
        />
      </div>
    );
  }

  const startedMs = data.carbStartedAt ? new Date(data.carbStartedAt).getTime() : now;
  const totalMs = msFor(data.carbDuration ?? 0, data.carbUnit ?? 'weeks') + (data.carbExtendMinutes ?? 0) * 60 * 1000;
  const elapsedMs = Math.max(0, now - startedMs);
  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const percent = totalMs > 0 ? Math.min(100, Math.round((elapsedMs / totalMs) * 100)) : 0;
  const days = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

  if (stage === 'extend') {
    return (
      <div className="flex flex-col gap-3.5">
        <p className="text-xs text-ink-text-secondary">Add more time to keep carbonating with {data.carbMethod}.</p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold text-ink-text-secondary">Additional Duration (days)</p>
            <Input
              type="number"
              min={1}
              value={extendAmount}
              onChange={(e) => setExtendAmount(Number(e.target.value))}
              className="w-[100px] font-mono"
            />
          </div>
          <Button
            variant="brand"
            disabled={fetcher.state !== 'idle'}
            onClick={() => {
              submit({ intent: 'extendCarbonation', extendMinutes: extendAmount * 24 * 60 });
              setStage('counting');
            }}
          >
            Extend Countdown
          </Button>
          <Button variant="outline" onClick={() => setStage('counting')}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // counting
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.5px] text-ink-text-faint">
            Total Carbonation Time Left · {data.carbMethod}
          </p>
          <p className="mt-1 font-mono text-[38px] font-light">
            {days}d {hours}h
          </p>
          <p className="mt-1 text-xs text-ink-text-faint">
            Started {data.carbStartedAt ? new Date(data.carbStartedAt).toLocaleString() : '—'}
          </p>
        </div>
        <Ring percent={percent} label="Complete" />
      </div>
      <div className="flex gap-2.5">
        <Button variant="outline" className="flex-1" onClick={() => setStage('extend')}>
          Extend
        </Button>
        <Button
          variant="brand"
          className="flex-1"
          disabled={fetcher.state !== 'idle'}
          onClick={() => submit({ intent: 'finishCarbonation' })}
        >
          Done
        </Button>
      </div>
    </div>
  );
};
