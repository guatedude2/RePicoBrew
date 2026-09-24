import { Select } from '~/components/ui/select';
import { BEER_STYLE_GROUPS } from '~/utils/beer-styles';

const KNOWN_STYLES = new Set(BEER_STYLE_GROUPS.flatMap((g) => g.styles));

// Recipe style picker. A style that isn't in the list (imported or AI-generated) stays selectable so an existing
// recipe never loses its value just by opening the editor.
export const StyleSelect = ({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (style: string) => void;
  className?: string;
}) => (
  <Select value={value} onChange={(e) => onChange(e.target.value)} className={className}>
    <option value="">No style</option>
    {value && !KNOWN_STYLES.has(value) && <option value={value}>{value}</option>}
    {BEER_STYLE_GROUPS.map(({ group, styles }) => (
      <optgroup key={group} label={group}>
        {styles.map((style) => (
          <option key={style} value={style}>
            {style}
          </option>
        ))}
      </optgroup>
    ))}
  </Select>
);
