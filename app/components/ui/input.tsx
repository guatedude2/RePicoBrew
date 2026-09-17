import * as React from 'react';
import { cn } from '~/lib/utils';

// Mirrors app/theme/components/input.ts's fieldBase styling.
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-lg border border-ink-input-border bg-ink-input-bg px-3 py-2 text-sm text-ink-text',
        'placeholder:text-ink-text-faintest',
        'focus-visible:outline-none focus-visible:border-brand-500 focus-visible:ring-1 focus-visible:ring-brand-500',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'read-only:cursor-default',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
