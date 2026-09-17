import * as React from 'react';
import { cn } from '~/lib/utils';

// Mirrors app/theme/additions/card/card.ts's baseStyle.
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'relative flex w-full min-w-0 flex-col rounded-[14px] border border-ink-card-border bg-ink-card p-5 break-words bg-clip-border',
      className,
    )}
    {...props}
  />
));
Card.displayName = 'Card';

export { Card };
