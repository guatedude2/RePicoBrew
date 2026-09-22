import type { FC } from 'react';
import { MdWarning } from 'react-icons/md';
import type { PicoStepWarning } from '~/utils/pico-step-ranges';

export const StepRangeWarnings: FC<{ warnings: PicoStepWarning[] }> = ({ warnings }) => {
  if (warnings.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-1.5 rounded-[10px] border border-orange-500/60 bg-orange-500/10 p-3.5">
      <div className="flex items-center gap-2 text-[13px] font-bold text-orange-400">
        <MdWarning className="size-[15px]" />
        Outside what official PicoPaks do
      </div>
      {warnings.map((w) => (
        <p key={`${w.stepIndex}-${w.message}`} className="pl-[23px] text-[13px] text-ink-text-secondary">
          {w.message}
        </p>
      ))}
      <p className="pl-[23px] text-[12px] text-ink-text-faint">
        Every official pak follows the same fixed step order and ranges. You can still save; check these before brewing.
      </p>
    </div>
  );
};
