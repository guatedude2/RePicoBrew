import type { FC } from 'react';
import type { IconType } from 'react-icons';

// oklch channel triples (no wrapping fn) so tinted/solid variants can be composed per stat card
export const ACCENT = {
  brand: '0.78 0.135 65',
  success: '0.72 0.14 145',
  info: '0.72 0.1 235',
  danger: '0.7 0.16 25',
  purple: '0.65 0.15 300',
};

export const StatCard: FC<{
  label: string;
  value: string;
  unit?: string;
  sub: string;
  icon: IconType;
  accent: string;
}> = ({ label, value, unit, sub, icon: Icon, accent }) => (
  <div className="relative overflow-hidden rounded-xl border border-ink-card-border bg-ink-card p-[18px]">
    <div
      className="absolute inset-x-0 top-0 h-0.5 opacity-70"
      style={{ background: `linear-gradient(to right, transparent, oklch(${accent}), transparent)` }}
    />
    <div className="flex items-center justify-between">
      <p className="text-xs font-semibold uppercase tracking-[0.4px] text-ink-text-faint">{label}</p>
      <div
        className="flex size-[30px] items-center justify-center rounded-lg"
        style={{ backgroundColor: `oklch(${accent} / 0.15)` }}
      >
        <Icon className="size-4" style={{ color: `oklch(${accent})` }} />
      </div>
    </div>
    <p className="mt-2.5 font-mono text-[26px] font-semibold">
      {value}
      {unit && <span className="text-[15px] text-ink-text-dim">{unit}</span>}
    </p>
    <p className="mt-0.5 text-xs text-ink-text-faint">{sub}</p>
  </div>
);
