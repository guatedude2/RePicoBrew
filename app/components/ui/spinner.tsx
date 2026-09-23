import { cn } from '~/lib/utils';

export const Spinner = ({ className }: { className?: string }) => (
  <span
    role="status"
    aria-label="Loading"
    className={cn(
      'inline-block size-3.5 flex-none animate-spin rounded-full border-2 border-current border-t-transparent',
      className,
    )}
  />
);
