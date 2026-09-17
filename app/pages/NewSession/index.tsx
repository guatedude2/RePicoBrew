import { Form, useActionData, useNavigate, useNavigation } from 'react-router';
import { useMemo, useState, type FC } from 'react';
import { MdArrowBack } from 'react-icons/md';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select } from '~/components/ui/select';
import { cn } from '~/lib/utils';
import { formatAbv, formatIbu } from '~/utils/brew-stats';
import { srmSwatchUrl } from '~/utils/srm-swatch';

const CARB_METHODS = [
  { label: 'Bottle', unit: 'weeks' },
  { label: 'Keg', unit: 'weeks' },
  { label: 'Forced (CO2)', unit: 'hours' },
];

interface RecipeOption {
  id: number;
  name: string;
  style: string | null;
  abv: number;
  ibu: number;
  photoUrl: string | null;
  colorSRM: number | null;
  fermentDays: number | null;
  steps: Array<{ stepTime: number; drainTime: number }>;
}

interface DeviceOption {
  id: number;
  name: string;
  color: string | null;
}

interface NewSessionProps {
  recipes: RecipeOption[];
  brewDevices: DeviceOption[];
  tiltDevices: DeviceOption[];
}

const formatMinutes = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) {
    return `${m}m`;
  }
  if (m === 0) {
    return `${h}h`;
  }
  return `${h}h ${m}m`;
};

export const NewSession: FC<NewSessionProps> = ({ recipes, brewDevices, tiltDevices }) => {
  const navigate = useNavigate();
  const navigation = useNavigation();
  const actionData = useActionData<{ error?: string }>();

  const [recipeId, setRecipeId] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [fermentDeviceId, setFermentDeviceId] = useState('');
  const [carbMethod, setCarbMethod] = useState('Bottle');
  const [carbDuration, setCarbDuration] = useState(2);

  const recipe = useMemo(() => recipes.find((r) => r.id === Number(recipeId)) ?? null, [recipes, recipeId]);
  const carbUnit = CARB_METHODS.find((m) => m.label === carbMethod)?.unit ?? 'weeks';

  const brewMinutes = useMemo(() => recipe?.steps.reduce((sum, s) => sum + s.stepTime + s.drainTime, 0) ?? 0, [recipe]);

  const estimate = useMemo(() => {
    const parts: string[] = [];
    if (recipe) {
      parts.push(`${formatMinutes(brewMinutes)} brew`);
    }
    if (recipe?.fermentDays) {
      parts.push(`${recipe.fermentDays}d ferment`);
    }
    parts.push(`${carbDuration}${carbUnit === 'weeks' ? 'w' : 'h'} carb`);
    return parts.join(' + ');
  }, [recipe, brewMinutes, carbDuration, carbUnit]);

  const isSubmitting = navigation.state === 'submitting';

  return (
    <>
      <div className="mb-1 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/sessions')}
          className="flex size-8 items-center justify-center rounded-[7px] border border-ink-card-border bg-ink-card"
        >
          <MdArrowBack className="size-[15px]" />
        </button>
        <p className="text-lg font-bold">New Session</p>
      </div>

      <Form method="post">
        <div className="flex max-w-[720px] flex-col gap-4">
          <Card className="gap-4 p-[22px]">
            <p className="text-sm font-bold">Recipe</p>
            <Select
              name="recipeId"
              placeholder="Select a recipe"
              value={recipeId}
              onChange={(e) => setRecipeId(e.target.value)}
            >
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} — {r.style || 'Unspecified style'}
                </option>
              ))}
            </Select>

            {recipe && (
              <div className="flex items-center gap-3.5 rounded-[10px] bg-ink-bg p-3">
                <img
                  src={recipe.photoUrl || srmSwatchUrl(recipe.colorSRM) || '/img/no-photo.jpg'}
                  alt={recipe.name}
                  className="size-14 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{recipe.name}</p>
                  <p className="mb-1.5 text-xs text-ink-text-faint">{recipe.style || 'Unspecified style'}</p>
                  <div className="flex gap-[18px] text-[11px] text-ink-text-secondary">
                    {recipe.abv >= 0 && (
                      <div>
                        <p className="text-ink-text-faint">ABV</p>
                        <p className="font-bold">{formatAbv(recipe.abv, { unit: false })}</p>
                      </div>
                    )}
                    {recipe.ibu >= 0 && (
                      <div>
                        <p className="text-ink-text-faint">IBU</p>
                        <p className="font-bold">{formatIbu(recipe.ibu, { unit: false })}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-ink-text-faint">Est. Brew Time</p>
                      <p className="font-bold">{formatMinutes(brewMinutes)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>

          <Card className="gap-4 p-[22px]">
            <p className="text-sm font-bold">Devices</p>
            <div className="flex flex-wrap gap-4">
              <div className="min-w-[220px] flex-1">
                <Label className="mb-1.5 block text-[11px] font-semibold text-ink-text-secondary">Brew Device *</Label>
                <Select
                  name="deviceId"
                  placeholder="Select a device"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                >
                  {brewDevices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="min-w-[220px] flex-1">
                <Label className="mb-1.5 block text-[11px] font-semibold text-ink-text-secondary">
                  Ferment Device (optional)
                </Label>
                <Select
                  name="fermentDeviceId"
                  value={fermentDeviceId}
                  onChange={(e) => setFermentDeviceId(e.target.value)}
                >
                  <option value="">None — manual tracking</option>
                  {tiltDevices.map((d) => (
                    <option key={d.id} value={d.id}>
                      Tilt · {d.color || d.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </Card>

          <Card className="gap-3.5 p-[22px]">
            <div>
              <p className="text-sm font-bold">Carbonation</p>
              <p className="text-xs text-ink-text-faint">
                Manual step — no sensor tracking. Choose method and how long.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {CARB_METHODS.map((m) => (
                <button
                  key={m.label}
                  type="button"
                  onClick={() => setCarbMethod(m.label)}
                  className={cn(
                    'rounded-lg border px-3.5 py-2.5 text-[13px] font-semibold',
                    carbMethod === m.label
                      ? 'border-brand-500 bg-brand-100 text-ink-text'
                      : 'border-ink-divider bg-ink-bg text-ink-text-secondary',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <input type="hidden" name="carbMethod" value={carbMethod} />
            <div className="max-w-[200px]">
              <Label className="mb-1.5 block text-[11px] font-semibold text-ink-text-secondary">
                Duration ({carbUnit})
              </Label>
              <Input
                type="number"
                name="carbDuration"
                value={carbDuration}
                onChange={(e) => setCarbDuration(Number(e.target.value))}
                min={1}
                className="font-mono"
              />
            </div>
          </Card>

          {actionData?.error && <p className="text-[13px] text-danger-500">{actionData.error}</p>}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold tracking-[0.5px] text-ink-text-faint">ESTIMATED TOTAL TIME</p>
              <p className="font-mono text-sm font-bold">{estimate}</p>
            </div>
            <Button type="submit" variant="brand" disabled={!recipeId || !deviceId || isSubmitting}>
              {isSubmitting ? 'Starting…' : 'Start Brewing'}
            </Button>
          </div>
        </div>
      </Form>
    </>
  );
};

export default NewSession;
