import type { FC } from 'react';
import { DeviceType } from '~/types';

// Icon glyphs matching the Settings design's device-type picker grid (Brewing/Fermentation
// swatches). Kept distinct from `DeviceType` because Pico S and Pico Pro are visually different
// physical units even though they share the same `DeviceType.PICOBREW` value under the hood — the
// wire protocol can't tell them apart, only the admin picking an icon can.
export type DeviceIconKind = 'picoS' | 'picoC' | 'picoPro' | 'zymatic' | 'zseries' | 'picoFerm' | 'ispindel' | 'tilt';

// Fallback icon per DeviceType, used when a claimed device has no `modelIcon` recorded in its
// metadata (e.g. claimed before this picker existed, or PICOBREW picked as either S or Pro).
export const DEFAULT_ICON_FOR_TYPE: Record<DeviceType, DeviceIconKind> = {
  [DeviceType.PICOBREW_C]: 'picoC',
  [DeviceType.PICOBREW]: 'picoS',
  [DeviceType.ZYMATIC]: 'zymatic',
  [DeviceType.ZSERIES]: 'zseries',
  [DeviceType.PICOFERM]: 'picoFerm',
  [DeviceType.ISPINDEL]: 'ispindel',
  [DeviceType.TILT]: 'tilt',
};

// Chakra color props (e.g. "ink.textSecondary") only resolve inside styled-system components —
// a raw <svg>'s stroke/fill attributes need an actual CSS value, so map the token to Chakra's
// generated CSS custom property instead of passing the token string straight through (which the
// browser can't parse and silently falls back to black).
function resolveColor(token: string): string {
  if (token === 'currentColor' || token.startsWith('#') || token.startsWith('oklch') || token.startsWith('var(')) {
    return token;
  }
  return `var(--chakra-colors-${token.replace(/\./g, '-')})`;
}

export const DeviceTypeIcon: FC<{ kind: DeviceIconKind; color?: string; size?: number }> = ({
  kind,
  color: colorProp = 'currentColor',
  size = 24,
}) => {
  const color = resolveColor(colorProp);
  const stroke = { fill: 'none', stroke: color, strokeWidth: 2 };

  switch (kind) {
    case 'picoS':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" {...stroke}>
          <rect x="14" y="8" width="20" height="34" rx="4" />
          <rect x="18" y="4" width="12" height="6" rx="1.5" />
          <circle cx="24" cy="22" r="5" />
          <line x1="18" y1="34" x2="30" y2="34" />
        </svg>
      );
    case 'picoC':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" {...stroke}>
          <rect x="10" y="10" width="28" height="30" rx="4" />
          <circle cx="24" cy="24" r="7" />
          <line x1="16" y1="16" x2="20" y2="16" />
          <line x1="28" y1="16" x2="32" y2="16" />
        </svg>
      );
    case 'picoPro':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" {...stroke}>
          <rect x="8" y="8" width="32" height="32" rx="5" />
          <circle cx="24" cy="22" r="7" />
          <line x1="16" y1="34" x2="32" y2="34" />
          <line x1="20" y1="14" x2="28" y2="14" />
        </svg>
      );
    case 'zymatic':
    case 'zseries':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" {...stroke}>
          <rect x="6" y="14" width="36" height="24" rx="4" />
          <circle cx="16" cy="26" r="4" />
          <circle cx="32" cy="26" r="4" />
          <line x1="6" y1="20" x2="42" y2="20" />
        </svg>
      );
    case 'picoFerm':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" {...stroke}>
          <path d="M18 6h12v10l4 6v16a4 4 0 01-4 4H18a4 4 0 01-4-4V22l4-6z" />
          <line x1="18" y1="24" x2="30" y2="24" />
        </svg>
      );
    case 'ispindel':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="19" fill="none" stroke={color} strokeWidth="2" />
          <text
            x="24"
            y="29"
            fontFamily="IBM Plex Mono, monospace"
            fontSize="13"
            fontWeight="700"
            fill={color}
            textAnchor="middle"
          >
            MTB
          </text>
        </svg>
      );
    case 'tilt':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="19" fill="none" stroke={color} strokeWidth="2" />
          <g transform="rotate(-30 24 24)">
            <rect x="21" y="10" width="6" height="26" rx="3" fill={color} />
            <circle cx="24" cy="35" r="6" fill={color} />
          </g>
        </svg>
      );
    default:
      return null;
  }
};
