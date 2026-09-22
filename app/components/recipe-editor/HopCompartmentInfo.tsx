import { MdInfoOutline } from 'react-icons/md';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip';

// The adjunct insert's four hop cages sit in a fixed physical layout inside the machine, numbered
// 1-4 from right to left (the reverse of how the Zymatic numbers them) — this is what "Adjunct1"
// through "Adjunct4" (the Compartment column) actually refer to.
export const HopCompartmentInfo = () => (
  <Tooltip>
    <TooltipTrigger type="button" className="inline-flex align-middle text-ink-text-faint hover:text-ink-text">
      <MdInfoOutline className="size-3.5" />
      <span className="sr-only">Where each hop compartment is located</span>
    </TooltipTrigger>
    <TooltipContent side="right" className="max-w-[320px] bg-white p-2">
      <img
        src="/img/adjunct-insert-hop-order.png"
        alt="Adjunct insert diagram: hop cages are ordered 1-4 from right to left, the reverse of the Zymatic's order"
        className="rounded-[6px]"
      />
    </TooltipContent>
  </Tooltip>
);
