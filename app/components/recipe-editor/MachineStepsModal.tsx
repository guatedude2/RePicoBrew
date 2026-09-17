import type { FC } from 'react';
import { MdAdd, MdDeleteOutline } from 'react-icons/md';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Select } from '~/components/ui/select';
import { PicoLocationMap } from '~/types';

export type MachineStepRow = {
  id: string;
  name: string;
  temperature: number;
  stepTime: number;
  drainTime: number;
  location: number;
};

const LOCATION_OPTIONS = Object.entries(PicoLocationMap)
  .filter(([key]) => Number.isNaN(Number(key)))
  .map(([label, value]) => ({ label, value: value as number }));

const columns = '36px 1.6fr 1fr 0.8fr 0.8fr 0.8fr';

const fieldClass = 'h-[34px] rounded-md bg-ink-bg text-[13px]';

export const MachineStepsModal: FC<{
  isOpen: boolean;
  onClose: () => void;
  steps: MachineStepRow[];
  onChange: (steps: MachineStepRow[]) => void;
  readOnly?: boolean;
}> = ({ isOpen, onClose, steps, onChange, readOnly = false }) => {
  const update = (id: string, field: keyof MachineStepRow, value: string | number) => {
    onChange(steps.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };
  const insertAfter = (index: number) => {
    const next = [...steps];
    next.splice(index + 1, 0, {
      id: Math.random().toString(36).slice(2),
      name: 'New Step',
      temperature: 152,
      stepTime: 10,
      drainTime: 0,
      location: PicoLocationMap.Adjunct1,
    });
    onChange(next);
  };
  const remove = (id: string) => onChange(steps.filter((s) => s.id !== id));
  const rowTemplateColumns = readOnly ? columns : `${columns} 64px`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle>Advanced Recipe Control Program Editor</DialogTitle>
          <p className="mt-0.5 text-xs font-normal text-ink-text-faint">
            Raw firmware steps run by the Pico — edit with care.
          </p>
        </DialogHeader>
        <div className="overflow-y-auto">
          <div
            className="grid gap-2 pb-2 text-[11px] font-bold uppercase text-ink-text-faintest"
            style={{ gridTemplateColumns: rowTemplateColumns }}
          >
            <span>#</span>
            <span>Name</span>
            <span>Location</span>
            <span>Temp °F</span>
            <span>Time min</span>
            <span>Drain min</span>
            {!readOnly && <span>Insert/Del</span>}
          </div>
          {steps.map((row, index) => (
            <div
              key={row.id}
              className={`grid items-center gap-2 py-1.5 ${index % 2 ? 'bg-ink-bg' : ''}`}
              style={{ gridTemplateColumns: rowTemplateColumns }}
            >
              <p className="text-center font-mono text-xs text-ink-text-faint">{index}</p>
              <Input
                value={row.name}
                readOnly={readOnly || index < 3}
                onChange={(e) => update(row.id, 'name', e.target.value)}
                className={fieldClass}
              />
              <Select
                value={row.location}
                disabled={readOnly || index < 3}
                onChange={(e) => update(row.id, 'location', Number(e.target.value))}
                className={fieldClass}
              >
                {LOCATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
              <Input
                type="number"
                value={row.temperature}
                readOnly={readOnly}
                onChange={(e) => update(row.id, 'temperature', Number(e.target.value))}
                className={`${fieldClass} font-mono`}
              />
              <Input
                type="number"
                value={row.stepTime}
                readOnly={readOnly}
                onChange={(e) => update(row.id, 'stepTime', Number(e.target.value))}
                className={`${fieldClass} font-mono`}
              />
              <Input
                type="number"
                value={row.drainTime}
                readOnly={readOnly}
                onChange={(e) => update(row.id, 'drainTime', Number(e.target.value))}
                className={`${fieldClass} font-mono`}
              />
              {!readOnly && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => insertAfter(index)}
                    className="flex size-[26px] items-center justify-center rounded-md bg-ink-card text-ink-text-secondary hover:bg-ink-card-hover"
                  >
                    <MdAdd className="size-[13px]" />
                  </button>
                  {index >= 3 && (
                    <button
                      type="button"
                      onClick={() => remove(row.id)}
                      className="flex size-[26px] items-center justify-center rounded-md bg-ink-card text-danger-500 hover:bg-ink-card-hover"
                    >
                      <MdDeleteOutline className="size-[13px]" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="brand" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
