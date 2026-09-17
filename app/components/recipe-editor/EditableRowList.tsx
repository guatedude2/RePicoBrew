import { MdAdd, MdDeleteOutline } from 'react-icons/md';
import { Input } from '~/components/ui/input';

export type RowColumn<T> = {
  key: Extract<keyof T, string>;
  label: string;
  type: 'text' | 'number';
  step?: number;
  placeholder?: string;
};

export function EditableRowList<T extends { id: string }>({
  rows,
  columns,
  templateColumns,
  onChange,
  onAdd,
  onRemove,
  addLabel,
  minRows = 0,
  readOnly = false,
}: {
  rows: T[];
  columns: Array<RowColumn<T>>;
  templateColumns: string;
  onChange: (id: string, key: Extract<keyof T, string>, value: string | number) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  addLabel: string;
  minRows?: number;
  readOnly?: boolean;
}) {
  const rowTemplateColumns = readOnly ? templateColumns : `${templateColumns} 32px`;

  return (
    <div className="flex flex-col gap-2">
      {rows.length > 0 && (
        <div
          className="grid gap-2 text-[11px] font-bold uppercase text-ink-text-faintest"
          style={{ gridTemplateColumns: rowTemplateColumns }}
        >
          {columns.map((col) => (
            <span key={col.key}>{col.label}</span>
          ))}
          {!readOnly && <div />}
        </div>
      )}
      {rows.map((row) => (
        <div key={row.id} className="grid items-center gap-2" style={{ gridTemplateColumns: rowTemplateColumns }}>
          {columns.map((col) =>
            readOnly ? (
              <p
                key={col.key}
                className={`px-2.5 py-2 text-[13px] text-ink-text-muted ${col.type === 'number' ? 'font-mono' : ''}`}
              >
                {(row[col.key] as string | number | undefined) ?? '—'}
              </p>
            ) : (
              <Input
                key={col.key}
                type={col.type}
                step={col.step}
                placeholder={col.placeholder}
                value={(row[col.key] as string | number | undefined) ?? ''}
                onChange={(e) =>
                  onChange(row.id, col.key, col.type === 'number' ? Number(e.target.value) : e.target.value)
                }
                className={`h-[34px] rounded-md bg-ink-bg text-[13px] ${col.type === 'number' ? 'font-mono' : ''}`}
              />
            ),
          )}
          {!readOnly &&
            (rows.length > minRows ? (
              <button
                type="button"
                onClick={() => onRemove(row.id)}
                className="flex size-7 items-center justify-center rounded-md text-danger-500 hover:bg-ink-card"
              >
                <MdDeleteOutline className="size-4" />
              </button>
            ) : (
              <div />
            ))}
        </div>
      ))}
      {!readOnly && (
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1.5 self-start rounded-md border border-ink-border-strong px-3 py-[7px] text-xs font-semibold text-ink-text-secondary hover:bg-ink-card"
        >
          <MdAdd className="size-3" />
          {addLabel}
        </button>
      )}
    </div>
  );
}
