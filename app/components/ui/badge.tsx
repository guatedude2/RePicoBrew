import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '~/lib/utils';

// Mirrors app/theme/components/badge.ts's baseStyle/variants.
const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full px-3 py-[5px] text-xs font-bold leading-none',
  {
    variants: {
      variant: {
        brand: 'bg-brand-100 text-brand-500',
        subtle: 'bg-ink-card text-ink-text-secondary',
      },
    },
    defaultVariants: { variant: 'brand' },
  },
);

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
