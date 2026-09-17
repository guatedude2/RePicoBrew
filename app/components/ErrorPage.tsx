import type { FC, ReactNode } from 'react';
import type { IconType } from 'react-icons';
import { cn } from '~/lib/utils';

export const ErrorPage: FC<{
  icon: IconType;
  code: string;
  heading: string;
  description: string;
  accent: 'brand' | 'danger';
  minH?: string;
  children?: ReactNode;
}> = ({ icon: Icon, code, heading, description, accent, minH = '60vh', children }) => (
  <div
    className="flex w-full flex-col items-center justify-center gap-[22px] px-6 py-6 text-center"
    style={{ minHeight: minH }}
  >
    <div
      className={cn(
        'flex size-16 items-center justify-center rounded-2xl',
        accent === 'brand' ? 'bg-gradient-to-br from-brand-300 to-brand-600' : 'border border-danger-500 bg-danger-100',
      )}
    >
      <Icon className={cn('size-7', accent === 'brand' ? 'text-ink-on-brand' : 'text-danger-500')} />
    </div>
    <p
      className={cn(
        'font-mono text-6xl font-bold leading-none',
        accent === 'brand' ? 'text-brand-500' : 'text-danger-500',
      )}
    >
      {code}
    </p>
    <div className="flex flex-col items-center gap-1.5">
      <p className="text-xl font-bold text-ink-text">{heading}</p>
      <p className="max-w-[380px] text-sm text-ink-text-dim">{description}</p>
    </div>
    <div className="flex gap-3">{children}</div>
  </div>
);
