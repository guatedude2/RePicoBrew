import * as React from 'react';
import { cn } from '~/lib/utils';

// A plain native <select>, styled to match Input — the app's only <select> uses (a 2-3 option
// role/model picker) don't need Radix Select's full listbox behavior.
const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'> & { placeholder?: string }>(
  ({ className, children, placeholder, defaultValue, value, ...props }, ref) => (
    <select
      className={cn(
        'flex h-10 w-full rounded-lg border border-ink-input-border bg-ink-input-bg px-3 py-2 text-sm text-ink-text',
        'focus-visible:outline-none focus-visible:border-brand-500 focus-visible:ring-1 focus-visible:ring-brand-500',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      ref={ref}
      {...(value === undefined ? { defaultValue: defaultValue ?? (placeholder ? '' : undefined) } : { value })}
      {...props}
    >
      {placeholder && (
        <option value="" disabled hidden>
          {placeholder}
        </option>
      )}
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

export { Select };
