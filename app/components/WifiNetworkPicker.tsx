import type { FC } from 'react';
import {
  MdCheck,
  MdLock,
  MdSignalWifi0Bar,
  MdSignalWifi1Bar,
  MdSignalWifi2Bar,
  MdSignalWifi3Bar,
  MdSignalWifi4Bar,
} from 'react-icons/md';
import { Input } from '~/components/ui/input';
import { cn } from '~/lib/utils';
import type { NearbyNetwork } from '~/utils/wifi.server';

const SignalIcon: FC<{ signal: number }> = ({ signal }) => {
  const Icon =
    signal >= 80
      ? MdSignalWifi4Bar
      : signal >= 60
      ? MdSignalWifi3Bar
      : signal >= 35
      ? MdSignalWifi2Bar
      : signal >= 15
      ? MdSignalWifi1Bar
      : MdSignalWifi0Bar;
  return <Icon className="size-4 text-ink-text-faint" />;
};

const NetworkRow: FC<{ network: NearbyNetwork; selected: boolean; onSelect: () => void }> = ({
  network,
  selected,
  onSelect,
}) => (
  <button
    type="button"
    onClick={onSelect}
    className={cn(
      'flex w-full items-center gap-2.5 border-b border-ink-divider px-3.5 py-2.5 text-left transition-colors last:border-b-0 hover:bg-ink-bg',
      selected && 'bg-ink-bg',
    )}
  >
    <span className="flex size-4 items-center justify-center text-brand-500">
      {selected && <MdCheck className="size-4" />}
    </span>
    <span className="flex-1 truncate text-sm">{network.ssid}</span>
    {network.secured && <MdLock className="size-3.5 text-ink-text-faint" />}
    <SignalIcon signal={network.signal} />
  </button>
);

interface WifiNetworkPickerProps {
  networks: NearbyNetwork[];
  knownSsid?: string | null;
  selectedSsid: string;
  onSelect: (ssid: string) => void;
  manualMode: boolean;
  onEnterManually: () => void;
  manualValue: string;
  onManualChange: (value: string) => void;
  disabled?: boolean;
}

// Modeled on macOS's Wi-Fi picker: a grouped list of scanned networks (the previously-configured
// one, if still in range, called out separately) with an "Other…" escape hatch for hidden/
// out-of-range networks — rather than a plain text field nobody can spell-check against reality.
export const WifiNetworkPicker: FC<WifiNetworkPickerProps> = ({
  networks,
  knownSsid,
  selectedSsid,
  onSelect,
  manualMode,
  onEnterManually,
  manualValue,
  onManualChange,
  disabled,
}) => {
  if (networks.length === 0 || manualMode) {
    return (
      <Input
        placeholder="Network Name"
        value={manualValue}
        disabled={disabled}
        onChange={(event) => onManualChange(event.target.value)}
      />
    );
  }

  const known = networks.find((n) => n.ssid === knownSsid);
  const others = networks.filter((n) => n.ssid !== knownSsid);

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-lg border border-ink-card-border">
        {known && (
          <div>
            <p className="bg-ink-bg px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-text-faint">
              Known Network
            </p>
            <NetworkRow network={known} selected={selectedSsid === known.ssid} onSelect={() => onSelect(known.ssid)} />
          </div>
        )}
        <div>
          <p className="bg-ink-bg px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-text-faint">
            {known ? 'Other Networks' : 'Networks'}
          </p>
          {others.map((network) => (
            <NetworkRow
              key={network.ssid}
              network={network}
              selected={selectedSsid === network.ssid}
              onSelect={() => onSelect(network.ssid)}
            />
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={onEnterManually}
        className="self-end text-xs font-semibold text-brand-500 hover:underline"
      >
        Other…
      </button>
    </div>
  );
};
