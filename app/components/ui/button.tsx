import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '~/lib/utils';

// Mirrors app/theme/components/button.ts's variants (solid/outline/brand/danger/ghost/link) and
// its disabled treatment (pointer-events disabled, static ink.borderStrong bg — see that file's
// comment for why opacity-dimming alone doesn't reliably suppress hover).
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-bold transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:bg-ink-border-strong disabled:text-ink-text-faint disabled:border-ink-border-strong [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        solid: 'bg-ink-card text-ink-text border border-ink-card-border hover:bg-ink-card-hover',
        outline: 'bg-transparent border border-ink-border-strong text-ink-text-secondary hover:bg-ink-card',
        brand: 'bg-brand-500 text-ink-on-brand hover:bg-brand-600 active:bg-brand-600',
        danger: 'bg-danger-600 text-white hover:bg-danger-500',
        ghost: 'text-ink-text-secondary hover:bg-ink-card hover:text-ink-text',
        link: 'text-brand-500 font-semibold hover:text-brand-300 underline-offset-4',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-[13px]',
        lg: 'h-11 rounded-lg px-6',
        xs: 'h-6 rounded-sm px-2 text-xs',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'solid',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
