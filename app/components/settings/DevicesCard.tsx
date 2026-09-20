import { useFetcher } from 'react-router';
import { useEffect, useState, type FC } from 'react';
import { MdDelete, MdDevices } from 'react-icons/md';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { DEFAULT_ICON_FOR_TYPE, DeviceTypeIcon, type DeviceIconKind } from '~/components/settings/DeviceTypeIcon';
import { cn } from '~/lib/utils';
import { DeviceState, DeviceType } from '~/types';
import { useServerSideEvent } from '~/utils/sse';

type ModelOption = { id: DeviceIconKind; label: string; deviceType: DeviceType; disabled?: boolean };

const BREWING_OPTIONS: ModelOption[] = [
  { id: 'picoS', label: 'Pico S', deviceType: DeviceType.PICOBREW },
  { id: 'picoC', label: 'Pico C', deviceType: DeviceType.PICOBREW_C },
  { id: 'picoPro', label: 'Pico Pro', deviceType: DeviceType.PICOBREW },
  { id: 'zymatic', label: 'Zymatic', deviceType: DeviceType.ZYMATIC, disabled: true },
  { id: 'zseries', label: 'Z Series', deviceType: DeviceType.ZSERIES, disabled: true },
];

const FERMENTATION_OPTIONS: ModelOption[] = [
  { id: 'picoFerm', label: 'PicoFerm', deviceType: DeviceType.PICOFERM },
  { id: 'ispindel', label: 'iSpindel', deviceType: DeviceType.ISPINDEL },
  { id: 'tilt', label: 'Tilt', deviceType: DeviceType.TILT },
];

const ALL_OPTIONS = [...BREWING_OPTIONS, ...FERMENTATION_OPTIONS];

function parseJSON(value: string | null): Record<string, unknown> {
  if (!value) {
    return {};
  }
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

type Device = {
  id: number;
  uid: string;
  name: string;
  deviceType: string;
  state: number;
  ipAddress: string | null;
  firmwareVersion: string | null;
  sessionCount: number;
  color: string | null; // Tilt color
  metadata: string | null; // JSON string
  online: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    sessions: number;
  };
};

type DiscoveredDevice = {
  uid: string;
  deviceType: string | null;
  metadata: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
};

interface DevicesCardProps {
  devices: Device[];
  discoveredDevices: DiscoveredDevice[];
}

const STATE_STYLES = {
  success: { dot: 'bg-success-500 shadow-[0_0_8px_var(--color-success-500)]', text: 'text-success-500' },
  info: { dot: 'bg-info-500 shadow-[0_0_8px_var(--color-info-500)]', text: 'text-info-500' },
  neutral: { dot: 'bg-ink-text-faintest', text: 'text-ink-text-faint' },
} as const;

// Connectivity (online/offline) is the device's real, network-derived status — see
// DeviceRepository.isDeviceOnline. "BREWING" is a separate, secondary badge for what an online
// Pico/Zymatic/Z-Series device is currently doing, not a substitute for connectivity.
const getConnectivityLabel = (online: boolean): { label: string; accent: keyof typeof STATE_STYLES } =>
  online ? { label: 'ONLINE', accent: 'success' } : { label: 'OFFLINE', accent: 'neutral' };

function deviceIconKind(device: Device): DeviceIconKind {
  const metadata = parseJSON(device.metadata);
  const modelIcon = metadata.modelIcon;
  if (typeof modelIcon === 'string' && ALL_OPTIONS.some((o) => o.id === modelIcon)) {
    return modelIcon as DeviceIconKind;
  }
  return DEFAULT_ICON_FOR_TYPE[device.deviceType as DeviceType] ?? 'picoC';
}

const ModelGrid: FC<{
  title: string;
  options: ModelOption[];
  selected: DeviceIconKind | null;
  onSelect: (option: ModelOption) => void;
}> = ({ title, options, selected, onSelect }) => (
  <div>
    <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-text-faint">{title}</p>
    <div className="flex flex-wrap gap-2.5">
      {options.map((option) => {
        const isSelected = selected === option.id;
        return (
          <button
            key={option.id}
            type="button"
            disabled={option.disabled}
            onClick={() => onSelect(option)}
            className={cn(
              'flex w-[76px] flex-col items-center gap-1.5 rounded-[10px] border px-2.5 py-2.5 transition-colors',
              isSelected ? 'border-brand-500 bg-brand-100' : 'border-ink-card-border bg-ink-bg',
              option.disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
            )}
          >
            <DeviceTypeIcon kind={option.id} size={30} color={isSelected ? 'brand-500' : 'ink-text-secondary'} />
            <span
              className={cn(
                'text-center text-[11px] font-semibold',
                isSelected ? 'text-ink-text' : 'text-ink-text-secondary',
              )}
            >
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
    {options.some((o) => o.disabled) && (
      <p className="mt-1.5 text-[11px] text-ink-text-faintest">Zymatic and Z Series aren&apos;t supported yet.</p>
    )}
  </div>
);

export const DevicesCard: FC<DevicesCardProps> = ({ devices, discoveredDevices }) => {
  const [open, setOpen] = useState(false);
  const [pairingTarget, setPairingTarget] = useState<DiscoveredDevice | null>(null);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<ModelOption | null>(null);
  const pairFetcher = useFetcher();
  const dismissFetcher = useFetcher();
  const deleteFetcher = useFetcher();
  const [deleteTarget, setDeleteTarget] = useState<Device | null>(null);

  // The loader's `online` snapshot is only as fresh as the last page load — this fills the gap
  // between loads with live pushes from device-monitor.server.ts, the same pattern Dashboard
  // uses for session-update.
  const [onlineOverrides, setOnlineOverrides] = useState<Record<string, boolean>>({});
  useServerSideEvent<{ uid: string; online: boolean }>('device-availability-update', (data) => {
    setOnlineOverrides((prev) => ({ ...prev, [data.uid]: data.online }));
  });
  useEffect(() => {
    setOnlineOverrides({});
  }, [devices]);

  const handleDelete = () => {
    if (!deleteTarget) {
      return;
    }
    deleteFetcher.submit({ intent: 'delete-device', id: String(deleteTarget.id) }, { method: 'post' });
    setDeleteTarget(null);
  };

  const openPairModal = (discovered: DiscoveredDevice) => {
    setPairingTarget(discovered);
    const metadata = parseJSON(discovered.metadata);
    setSelected(ALL_OPTIONS.find((o) => o.deviceType === discovered.deviceType) ?? null);
    setName(typeof metadata.name === 'string' ? metadata.name : '');
    setOpen(true);
  };

  const handlePair = () => {
    if (!pairingTarget || !name || !selected) {
      return;
    }
    const metadata = parseJSON(pairingTarget.metadata);
    pairFetcher.submit(
      {
        intent: 'pair-device',
        uid: pairingTarget.uid,
        name,
        deviceType: selected.deviceType,
        modelIcon: selected.id,
        ...(typeof metadata.color === 'string' ? { color: metadata.color } : {}),
      },
      { method: 'post' },
    );
    setOpen(false);
  };

  const handleDismiss = (discoveredUid: string) => {
    dismissFetcher.submit({ intent: 'dismiss-discovered-device', uid: discoveredUid }, { method: 'post' });
  };

  return (
    <>
      <Card className="p-6">
        <p className="text-[17px] font-bold">Devices</p>
        <p className="mb-3.5 mt-1 text-[13px] text-ink-text-dim">
          Devices show up here automatically as they connect to your network — pair each one manually to give it a name
          before it can be used.
        </p>

        {discoveredDevices.length > 0 && (
          <div className="mb-4.5 border-b border-ink-divider pb-4.5">
            <p className="mb-2.5 text-xs font-bold uppercase text-ink-text-faint">Discovered Devices</p>
            <div className="flex flex-col gap-2.5">
              {discoveredDevices.map((discovered) => (
                <div
                  key={discovered.uid}
                  className="flex items-center gap-3.5 rounded-[10px] border border-dashed border-brand-500 p-3.5"
                >
                  <div className="flex size-8 flex-none items-center justify-center rounded-lg border border-ink-card-border bg-ink-bg">
                    <DeviceTypeIcon
                      kind={
                        discovered.deviceType ? DEFAULT_ICON_FOR_TYPE[discovered.deviceType as DeviceType] : 'picoC'
                      }
                      size={20}
                      color="ink-text-secondary"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">Discovered Device</p>
                    <p className="truncate font-mono text-xs text-ink-text-faint">{discovered.uid}</p>
                  </div>
                  <Button
                    size="xs"
                    className="w-[76px]"
                    variant="outline"
                    onClick={() => handleDismiss(discovered.uid)}
                  >
                    Dismiss
                  </Button>
                  <Button size="xs" className="w-[76px]" variant="brand" onClick={() => openPairModal(discovered)}>
                    Pair
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {devices.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <MdDevices className="size-12 text-ink-text-faintest" />
            <p className="text-ink-text-faint">No devices registered yet</p>
            <p className="text-[13px] text-ink-text-faintest">Power on your Pico or Tilt and connect to the network</p>
          </div>
        ) : (
          devices.map((device) => {
            const isTilt = device.deviceType === 'TILT';
            const online = onlineOverrides[device.uid] ?? device.online;
            const connectivity = getConnectivityLabel(online);
            const connectivityStyle = STATE_STYLES[connectivity.accent];
            const isBrewing = !isTilt && online && device.state === DeviceState.BREWING;
            const metadata = parseJSON(device.metadata);

            return (
              <div key={device.id} className="flex items-center gap-3.5 border-t border-ink-divider py-3">
                <div className="flex size-8 flex-none items-center justify-center rounded-lg border border-ink-card-border bg-ink-bg">
                  <DeviceTypeIcon kind={deviceIconKind(device)} size={20} color="ink-text-secondary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">
                    {device.name}
                    {isTilt && device.color ? ` · ${device.color}` : ''}
                  </p>
                  <p className="text-xs text-ink-text-faint">
                    {device.uid.substring(0, 16)}
                    {isTilt && metadata.rssi !== undefined ? ` · ${metadata.rssi} dBm` : ''}
                    {!isTilt && device.ipAddress ? ` · ${device.ipAddress}` : ''}
                  </p>
                </div>
                {isBrewing && (
                  <p className="rounded-md bg-info-100 px-1.5 py-[2px] text-[10px] font-bold text-info-500">BREWING</p>
                )}
                <div className={cn('size-[9px] shrink-0 rounded-full', connectivityStyle.dot)} />
                <p className={cn('text-[11px] font-bold', connectivityStyle.text)}>{connectivity.label}</p>
                <button
                  type="button"
                  aria-label={`Remove ${device.name}`}
                  onClick={() => setDeleteTarget(device)}
                  className="text-ink-text-faint transition-colors hover:text-danger-500"
                >
                  <MdDelete className="size-4" />
                </button>
              </div>
            );
          })
        )}
      </Card>

      <Dialog open={!!deleteTarget} onOpenChange={(isOpen) => !isOpen && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Device</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-ink-text-secondary">
            Are you sure you want to remove <span className="font-semibold text-ink-text">{deleteTarget?.name}</span>?
            Its session history will be kept, but it will need to be re-paired to use again.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={deleteFetcher.state !== 'idle'} onClick={handleDelete}>
              {deleteFetcher.state !== 'idle' ? 'Removing…' : 'Remove Device'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Pair Device</DialogTitle>
            {pairingTarget && <p className="mt-0.5 font-mono text-xs text-ink-text-faint">{pairingTarget.uid}</p>}
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <ModelGrid
              title="Brewing Devices"
              options={BREWING_OPTIONS}
              selected={selected?.id ?? null}
              onSelect={setSelected}
            />
            <ModelGrid
              title="Fermentation Devices"
              options={FERMENTATION_OPTIONS}
              selected={selected?.id ?? null}
              onSelect={setSelected}
            />
            <div>
              <Label htmlFor="device-name">Device Name</Label>
              <Input
                id="device-name"
                className="mt-1.5"
                placeholder="e.g., Garage Pico"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="brand" disabled={!name || !selected || pairFetcher.state !== 'idle'} onClick={handlePair}>
              {pairFetcher.state !== 'idle' ? 'Pairing…' : 'Pair Device'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
