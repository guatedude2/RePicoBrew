import type { FC } from 'react';
import { MdMenuBook, MdOpenInNew } from 'react-icons/md';
import type { DeviceIconKind } from '~/components/settings/DeviceTypeIcon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { manualsForModel } from '~/utils/device-manuals';

// A device's official PicoBrew manuals (Manual, Coffee, Manual Brew, Troubleshooting, ...), each opening the
// PDF in a new tab. Renders nothing for devices PicoBrew never published manuals for (Tilt, iSpindel).
export const DeviceManualsMenu: FC<{ kind: DeviceIconKind; deviceName: string }> = ({ kind, deviceName }) => {
  const manuals = manualsForModel(kind);
  if (manuals.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Manuals for ${deviceName}`}
          title="Manuals"
          className="text-ink-text-faint transition-colors hover:text-ink-text"
        >
          <MdMenuBook className="size-[17px]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {manuals.map((manual) => (
          <DropdownMenuItem key={manual.slug} asChild>
            <a href={`/manuals/${manual.slug}`} target="_blank" rel="noreferrer">
              {manual.title}
              <MdOpenInNew className="ml-auto size-3.5 text-ink-text-faint" />
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
