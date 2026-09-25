import type { ReactNode } from 'react';
import { MdInfoOutline } from 'react-icons/md';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip';

// A small (i) icon that explains a field on hover, focus or tap.
export const InfoTip = ({ label, children }: { label: string; children: ReactNode }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        aria-label={`About ${label}`}
        className="inline-flex text-ink-text-faint transition-colors hover:text-ink-text focus-visible:text-ink-text focus-visible:outline-none"
      >
        <MdInfoOutline className="size-3.5" />
      </button>
    </TooltipTrigger>
    <TooltipContent className="max-w-[270px] text-[12px] font-normal normal-case leading-snug">
      {children}
    </TooltipContent>
  </Tooltip>
);
