import * as React from 'react';
import { cn } from '~/lib/utils';

// Mirrors app/theme/components/textarea.ts's "main" variant (input.ts's fieldBase).
const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        'flex w-full rounded-lg border border-ink-input-border bg-ink-input-bg px-3 py-2 text-sm text-ink-text',
        'placeholder:text-ink-text-faintest',
        'focus-visible:outline-none focus-visible:border-brand-500 focus-visible:ring-1 focus-visible:ring-brand-500',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export { Textarea };
