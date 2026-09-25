import { Form, Link, useNavigate, useNavigation } from 'react-router';
import { useEffect, useMemo, useRef, useState, type FC } from 'react';
import { MdArrowBack, MdCameraAlt, MdEdit, MdError, MdExpandMore } from 'react-icons/md';
import { useRegisterAiRecipeBridge } from '~/components/recipes/AiSidekickContext';
import { StyleSelect } from '~/components/recipe-editor/StyleSelect';
import { Badge } from '~/components/ui/badge';
import { InfoTip } from '~/components/ui/info-tip';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Checkbox } from '~/components/ui/checkbox';
import { Input } from '~/components/ui/input';
import { Select } from '~/components/ui/select';
import { Textarea } from '~/components/ui/textarea';
import { EditableRowList } from '~/components/recipe-editor/EditableRowList';
import { MachineStepsModal, type MachineStepRow } from '~/components/recipe-editor/MachineStepsModal';
import { cn } from '~/lib/utils';
import type { AiIngredientRow, ZPackAiRecipe } from '~/services/ai-recipe-generator.server';
import { IngredientSection, PicoLocationMap, RecipePackType } from '~/types';
import { UnsavedChangesPrompt } from '~/components/UnsavedChangesPrompt';
import { RecipeActionsMenu } from '~/components/recipes/RecipeActionsMenu';
import { dirtyClass } from '~/utils/form-dirty';
import { StepRangeWarnings } from '~/components/recipe-editor/StepRangeWarnings';
import { validatePicoRecipe } from '~/utils/pico-recipe-validation';
import { getPicoStepWarnings } from '~/utils/pico-step-ranges';
import { srmSwatchUrl } from '~/utils/srm-swatch';
import { displayToOz, ozToDisplay, useWeightUnit, type WeightUnit } from '~/utils/weight-unit';

const RECIPE_FORM_ID = 'recipe-form';

type Row = {
  id: string;
  name: string;
  amount?: number;
  unit?: string;
  color?: number;
  aa?: number;
  time?: number;
  temp?: number;
  days?: number;
  hours?: number;
};

const newId = () => Math.random().toString(36).slice(2);
const emptyRow = (fields: Partial<Row> = {}): Row => ({ id: newId(), name: '', ...fields });

// Converts an AI Brewmaster ingredient row into the editor's own Row shape, dropping any rows the
// model left nameless.
// The AI always reasons in ounces regardless of the display setting, so hop amounts (the only
// weight-bearing field these two functions handle — mash/fermentation steps have none, and
// fermentables are in lbs, sent through a separate path) are converted at this boundary.
const aiRowsToRows = (items: AiIngredientRow[] | undefined, weightUnit: WeightUnit, isWeightOz = false): Row[] =>
  (items ?? [])
    .filter((r) => r.name?.trim())
    .map((r) => ({
      id: newId(),
      name: r.name,
      amount: isWeightOz && r.amount !== undefined ? ozToDisplay(r.amount, weightUnit) : r.amount,
      unit: r.unit,
      color: r.color,
      aa: r.aa,
      time: r.time,
      temp: r.temp,
      days: r.days,
      hours: r.hours,
    }));

// The inverse of aiRowsToRows — used to tell the AI Brewmaster what the editor's current
// ingredient rows are, for a "tweak this recipe" edit request.
const rowsToAiRows = (items: Row[], weightUnit: WeightUnit, isWeightOz = false): AiIngredientRow[] =>
  items
    .filter((r) => r.name.trim())
    .map((r) => ({
      name: r.name,
      amount: isWeightOz && r.amount !== undefined ? displayToOz(r.amount, weightUnit) : r.amount,
      unit: r.unit,
      color: r.color,
      aa: r.aa,
      time: r.time,
      temp: r.temp,
      days: r.days,
      hours: r.hours,
    }));

const GRAIN_PALETTE = ['oklch(0.75 0.1 75)', 'oklch(0.6 0.13 45)', 'oklch(0.5 0.1 35)', 'oklch(0.65 0.12 90)'];
const HOP_PALETTE = ['oklch(0.75 0.15 145)', 'oklch(0.6 0.14 150)', 'oklch(0.45 0.1 155)', 'oklch(0.68 0.13 135)'];

function buildDonut(items: Row[], palette: string[]) {
  const total = items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const legend = items.map((i, idx) => ({ label: i.name || 'Unnamed', color: palette[idx % palette.length] }));
  if (total <= 0) {
    return { background: 'oklch(0.28 0.008 260)', legend };
  }
  let acc = 0;
  const stops = items.map((i, idx) => {
    const pct = ((Number(i.amount) || 0) / total) * 100;
    const seg = `${palette[idx % palette.length]} ${acc}% ${acc + pct}%`;
    acc += pct;
    return seg;
  });
  return { background: `conic-gradient(${stops.join(',')})`, legend };
}

const fmtDuration = (mins: number) => `${Math.floor(mins / 60)} hrs and ${Math.round(mins % 60)} min`;

const machineStepToRow = (s: {
  name: string;
  temperature: number;
  stepTime: number;
  drainTime: number;
  location: number;
}): MachineStepRow => ({
  id: newId(),
  name: s.name,
  temperature: s.temperature,
  stepTime: s.stepTime,
  drainTime: s.drainTime,
  location: s.location,
});

const DEFAULT_MACHINE_STEPS: MachineStepRow[] = [
  {
    id: newId(),
    name: 'Preparing To Brew',
    location: PicoLocationMap.Prime,
    temperature: 70,
    stepTime: 3,
    drainTime: 0,
  },
  { id: newId(), name: 'Heating', location: PicoLocationMap.PassThru, temperature: 110, stepTime: 0, drainTime: 0 },
  { id: newId(), name: 'Dough In', location: PicoLocationMap.Mash, temperature: 110, stepTime: 7, drainTime: 0 },
];

export type RecipeEditorIngredient = {
  section: string;
  name: string;
  amount: number | null;
  unit: string | null;
  color: number | null;
  aa: number | null;
  time: number | null;
  temp: number | null;
  days: number | null;
  hours: number | null;
};

export type RecipeEditorData = {
  id: number;
  name: string;
  style: string | null;
  fermentDays: number | null;
  notes: string | null;
  photoUrl: string | null;
  og: number | null;
  fg: number | null;
  ibu: number;
  colorSRM: number | null;
  abv: number;
  ogMin: number | null;
  ogMax: number | null;
  fgMin: number | null;
  fgMax: number | null;
  ibuMin: number | null;
  ibuMax: number | null;
  srmMin: number | null;
  srmMax: number | null;
  abvMin: number | null;
  abvMax: number | null;
  batchSize: number | null;
  mashType: number | null;
  boilTime: number | null;
  boilTemp: number | null;
  firstWortHopping: boolean;
  fermentationType: number | null;
  yeastName: string | null;
  yeastAttenuation: number | null;
  yeastRangeTemp: string | null;
  yeastPitchTemp: number | null;
  steps: Array<{ name: string; temperature: number; stepTime: number; drainTime: number; location: number }>;
  ingredients: RecipeEditorIngredient[];
};

const FieldLabel: FC<{ children: React.ReactNode; tip?: string }> = ({ children, tip }) => (
  <p className="mb-[5px] flex items-center gap-1 text-[11px] font-semibold text-ink-text-secondary">
    {children}
    {tip && <InfoTip label={typeof children === 'string' ? children : 'this field'}>{tip}</InfoTip>}
  </p>
);

// Small sub-label used inside grouped fields (e.g. under "Yeast"), with an optional (i) explanation.
const SubLabel: FC<{ children: string; tip?: string }> = ({ children, tip }) => (
  <p className="mb-1 flex items-center gap-1 text-[10px] text-ink-text-faintest">
    {children}
    {tip && <InfoTip label={children}>{tip}</InfoTip>}
  </p>
);

const FieldValue: FC<{ children: React.ReactNode; mono?: boolean }> = ({ children, mono }) => (
  <p className={cn('px-2.5 py-2 text-sm text-ink-text-muted', mono && 'font-mono')}>{children}</p>
);

const MASH_TYPE_LABELS: Record<string, string> = {
  '0': 'Single Step Infusion',
  '3': 'Single Step Infusion With Mash Out',
  '1': 'High Efficiency Multi Step',
  '2': 'Custom',
};

const FERMENTATION_TYPE_LABELS: Record<string, string> = {
  '0': 'Ale',
  '1': 'Lager',
  '2': 'Advanced / Custom',
};

const SectionLabel: FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="mb-2 text-xs font-bold uppercase tracking-[0.4px] text-ink-text-faint">{children}</p>
);

const OverviewStat: FC<{
  label: string;
  value: React.ReactNode;
  min?: string;
  max?: string;
  input?: React.ReactNode;
  tip?: string;
}> = ({ label, value, min, max, input, tip }) => (
  <div>
    <p className="flex items-center gap-1 text-[11px] font-bold uppercase text-ink-text-faint">
      {label}
      {tip && <InfoTip label={label}>{tip}</InfoTip>}
    </p>
    {input ?? <p className="mt-1 px-2 py-1.5 font-mono text-sm font-bold">{value}</p>}
    {(min || max) && (
      <p className="mt-1 text-[10px] text-ink-text-faintest">
        MIN {min ?? '—'} · MAX {max ?? '—'}
      </p>
    )}
  </div>
);

// Fermentables are always in lbs; only these two sections' "amount" is oz-denominated and needs
// converting between the stored canonical ounces and whatever unit Settings has selected.
const WEIGHT_OZ_SECTIONS = new Set<IngredientSection>([IngredientSection.BOIL_HOP, IngredientSection.DRY_HOP]);

const rowsToIngredients = (
  rows: Row[],
  section: IngredientSection,
  fields: Array<keyof Row>,
  weightUnit: WeightUnit,
): RecipeEditorIngredient[] =>
  rows
    .filter((r) => r.name.trim() !== '')
    .map((r) => ({
      section,
      name: r.name,
      amount: fields.includes('amount')
        ? (r.amount !== undefined && WEIGHT_OZ_SECTIONS.has(section) ? displayToOz(r.amount, weightUnit) : r.amount) ??
          null
        : null,
      unit: fields.includes('unit') ? r.unit ?? null : null,
      color: fields.includes('color') ? r.color ?? null : null,
      aa: fields.includes('aa') ? r.aa ?? null : null,
      time: fields.includes('time') ? r.time ?? null : null,
      temp: fields.includes('temp') ? r.temp ?? null : null,
      days: fields.includes('days') ? r.days ?? null : null,
      hours: fields.includes('hours') ? r.hours ?? null : null,
    }));

export const RecipeEditor: FC<{ recipe?: RecipeEditorData; deviceType: string; readOnly?: boolean }> = ({
  recipe,
  deviceType,
  readOnly = false,
}) => {
  const navigate = useNavigate();
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== 'idle';
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Dirty-field highlighting only makes sense against a real "originally loaded" recipe — a
  // brand-new recipe has no original to diff against, so nothing is ever flagged there.
  const isEditingExisting = Boolean(recipe) && !readOnly;
  const weightUnit = useWeightUnit();

  const bySection = (section: IngredientSection): Row[] =>
    (recipe?.ingredients ?? [])
      .filter((i) => i.section === section)
      .map((i) => ({
        id: newId(),
        name: i.name,
        amount:
          i.amount != null && WEIGHT_OZ_SECTIONS.has(section)
            ? ozToDisplay(i.amount, weightUnit)
            : i.amount ?? undefined,
        unit: i.unit ?? undefined,
        color: i.color ?? undefined,
        aa: i.aa ?? undefined,
        time: i.time ?? undefined,
        temp: i.temp ?? undefined,
        days: i.days ?? undefined,
        hours: i.hours ?? undefined,
      }));

  const [name, setName] = useState(recipe?.name ?? '');
  const [style, setStyle] = useState(recipe?.style ?? '');
  const [notes, setNotes] = useState(recipe?.notes ?? '');
  const [photoUrl] = useState(recipe?.photoUrl ?? null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(recipe?.photoUrl ?? null);

  const [og, setOg] = useState(recipe?.og ?? 1.05);
  const [ibu, setIbu] = useState(recipe?.ibu ?? 30);
  const [fermentDays, setFermentDays] = useState<number | ''>(recipe?.fermentDays ?? '');
  const [fg, setFg] = useState<number | null>(recipe?.fg ?? null);
  const [srm, setSrm] = useState<number | null>(recipe?.colorSRM ?? null);
  const abv = fg != null ? Math.max(0, (og - fg) * 131.25) : recipe?.abv ?? 0;

  const [batchSize, setBatchSize] = useState(recipe?.batchSize ?? 2.5);
  const startingWater = (batchSize * 1.41).toFixed(2);

  const [amendments, setAmendments] = useState<Row[]>(bySection(IngredientSection.WATER));
  const [mashType, setMashType] = useState(String(recipe?.mashType ?? 0));
  const initialMashSteps = bySection(IngredientSection.MASH_STEP);
  const [mashSteps, setMashSteps] = useState<Row[]>(
    initialMashSteps.length ? initialMashSteps : [emptyRow({ name: 'Single Step Infusion Mash', temp: 152, time: 60 })],
  );
  const [fermentables, setFermentables] = useState<Row[]>(bySection(IngredientSection.FERMENTABLE));

  const [boilTime, setBoilTime] = useState(recipe?.boilTime ?? 60);
  const [boilTemp, setBoilTemp] = useState(recipe?.boilTemp ?? 207);
  const [firstWortHopping, setFirstWortHopping] = useState(recipe?.firstWortHopping ?? false);
  const [hops, setHops] = useState<Row[]>(bySection(IngredientSection.BOIL_HOP));
  const [otherBoil, setOtherBoil] = useState<Row[]>(bySection(IngredientSection.OTHER_BOIL));

  const [fermentationType, setFermentationType] = useState(String(recipe?.fermentationType ?? 0));
  const [yeastName, setYeastName] = useState(recipe?.yeastName ?? '');
  const [yeastAttenuation, setYeastAttenuation] = useState(recipe?.yeastAttenuation ?? 75);
  const [yeastRangeTemp, setYeastRangeTemp] = useState(recipe?.yeastRangeTemp ?? '');
  const [yeastPitchTemp, setYeastPitchTemp] = useState(recipe?.yeastPitchTemp ?? 65);
  const [fermentationSteps, setFermentationSteps] = useState<Row[]>(bySection(IngredientSection.FERMENTATION_STEP));
  const [dryHops, setDryHops] = useState<Row[]>(bySection(IngredientSection.DRY_HOP));

  const [machineSteps, setMachineSteps] = useState<MachineStepRow[]>(
    recipe?.steps?.length ? recipe.steps.map(machineStepToRow) : DEFAULT_MACHINE_STEPS,
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [machineStepsExpanded, setMachineStepsExpanded] = useState(false);

  // Pre-fills the in-progress form from an AI Brewmaster draft — mirrors setting each field by
  // hand. Never auto-saves; the user still reviews and hits Save Recipe themselves.
  const handleAiGenerated = (aiRecipe: ZPackAiRecipe) => {
    setName(aiRecipe.name);
    if (aiRecipe.style) {
      setStyle(aiRecipe.style);
    }
    if (aiRecipe.notes) {
      setNotes(aiRecipe.notes);
    }
    setOg(aiRecipe.og);
    setFg(aiRecipe.fg);
    setSrm(aiRecipe.colorSRM);
    setIbu(aiRecipe.ibu);
    setBatchSize(aiRecipe.batchSize);
    setMashType(String(aiRecipe.mashType));
    setBoilTime(aiRecipe.boilTime);
    setBoilTemp(aiRecipe.boilTemp);
    setFirstWortHopping(aiRecipe.firstWortHopping);
    setFermentationType(String(aiRecipe.fermentationType));
    setYeastName(aiRecipe.yeastName);
    setYeastAttenuation(aiRecipe.yeastAttenuation);
    setYeastRangeTemp(aiRecipe.yeastRangeTemp);
    setYeastPitchTemp(aiRecipe.yeastPitchTemp);
    setFermentables(aiRowsToRows(aiRecipe.fermentables, weightUnit));
    const aiMashSteps = aiRowsToRows(aiRecipe.mashSteps, weightUnit);
    setMashSteps(
      aiMashSteps.length ? aiMashSteps : [emptyRow({ name: 'Single Step Infusion Mash', temp: 152, time: 60 })],
    );
    setHops(aiRowsToRows(aiRecipe.hops, weightUnit, true));
    setDryHops(aiRowsToRows(aiRecipe.dryHops, weightUnit, true));
    setFermentationSteps(aiRowsToRows(aiRecipe.fermentationSteps, weightUnit));
    setMachineSteps(aiRecipe.steps.map(machineStepToRow));
    setMachineStepsExpanded(true);
  };

  // What the sidekick sends back as "the current recipe" for a "tweak this" edit request — kept
  // in sync with every field the AI can touch, same shape as a fresh generation returns.
  const currentAiRecipe: ZPackAiRecipe = useMemo(
    () => ({
      name,
      style,
      abv,
      ibu,
      notes,
      og,
      fg: fg ?? 1.01,
      colorSRM: srm ?? 6,
      batchSize,
      boilTime,
      boilTemp,
      firstWortHopping,
      mashType: Number(mashType),
      fermentationType: Number(fermentationType),
      yeastName,
      yeastAttenuation,
      yeastRangeTemp,
      yeastPitchTemp,
      fermentables: rowsToAiRows(fermentables, weightUnit),
      mashSteps: rowsToAiRows(mashSteps, weightUnit),
      hops: rowsToAiRows(hops, weightUnit, true),
      dryHops: rowsToAiRows(dryHops, weightUnit, true),
      fermentationSteps: rowsToAiRows(fermentationSteps, weightUnit),
      steps: machineSteps.map(({ id: _id, ...rest }) => rest),
    }),
    [
      name,
      style,
      abv,
      ibu,
      notes,
      og,
      fg,
      srm,
      batchSize,
      boilTime,
      boilTemp,
      firstWortHopping,
      mashType,
      fermentationType,
      yeastName,
      yeastAttenuation,
      yeastRangeTemp,
      yeastPitchTemp,
      fermentables,
      mashSteps,
      hops,
      dryHops,
      fermentationSteps,
      machineSteps,
      weightUnit,
    ],
  );

  // A brand-new recipe (no `recipe` prop) may have an AI-drafted recipe waiting from the global
  // sidekick's "create me a new recipe" chat action (see AiBrewmasterModal.tsx / api.ai-chat.ts) —
  // it stashes the draft in sessionStorage right before navigating here, since a GET navigation has
  // nowhere else to carry a full recipe payload. Picked up once on mount, same "AI drafts, human
  // reviews and hits Save" pattern as every other AI entry point into this editor.
  useEffect(() => {
    if (recipe) {
      return;
    }
    const raw = sessionStorage.getItem('ai-draft-recipe');
    if (!raw) {
      return;
    }
    try {
      const draft = JSON.parse(raw) as { packType?: string; recipe?: ZPackAiRecipe };
      if (draft.packType === 'zpack' && draft.recipe) {
        handleAiGenerated(draft.recipe);
      }
    } catch {
      // malformed/foreign draft — ignore rather than half-apply it
    } finally {
      sessionStorage.removeItem('ai-draft-recipe');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Publishes this editor's live recipe state to the globally-rendered AI Brewmaster sidekick (see
  // MainLayout.tsx) so it can drive generate/edit requests for THIS recipe — same contract as when
  // the sidekick used to be embedded directly here. Not published in read-only mode, matching the
  // sidekick's old `!readOnly` gate.
  useRegisterAiRecipeBridge(
    readOnly
      ? null
      : {
          packType: 'zpack',
          hasContent: Boolean(name.trim()),
          recipeLabel: name.trim() || 'New Recipe',
          currentRecipe: currentAiRecipe,
          onGenerated: (r) => handleAiGenerated(r as ZPackAiRecipe),
        },
  );

  const initialSnapshotRef = useRef({
    name,
    mashStepsCount: mashSteps.length,
    yeastName,
    boilTime,
    machineStepsJson: JSON.stringify(machineSteps.map(({ id: _id, ...rest }) => rest)),
  });

  const rowActions = (setter: (fn: (rows: Row[]) => Row[]) => void) => ({
    onChange: (id: string, key: keyof Row, value: string | number) =>
      setter((rows) => rows.map((r) => (r.id === id ? { ...r, [key]: value } : r))),
    onAdd: (template: Partial<Row> = {}) => setter((rows) => [...rows, emptyRow(template)]),
    onRemove: (id: string) => setter((rows) => rows.filter((r) => r.id !== id)),
  });

  const amendmentActions = rowActions(setAmendments);
  const mashStepActions = rowActions(setMashSteps);
  const fermentableActions = rowActions(setFermentables);
  const hopActions = rowActions(setHops);
  const otherBoilActions = rowActions(setOtherBoil);
  const fermentationStepActions = rowActions(setFermentationSteps);
  const dryHopActions = rowActions(setDryHops);

  const grain = useMemo(() => buildDonut(fermentables, GRAIN_PALETTE), [fermentables]);
  const hopDonut = useMemo(() => buildDonut(hops, HOP_PALETTE), [hops]);

  const wort = useMemo(() => {
    const mashTotalTime = mashSteps.reduce((sum, m) => sum + (Number(m.time) || 0), 0);
    const brewMinutes = mashTotalTime + boilTime;
    const chillMinutes = Math.round(30 + batchSize * 12);
    const maxTemp = Math.max(boilTemp, ...mashSteps.map((m) => Number(m.temp) || 0), 100);
    const plotW = 220;
    const plotX0 = 30;
    const plotY0 = 100;
    const plotH = 90;
    let t = 0;
    const pts = [`${plotX0},${plotY0}`];
    mashSteps.forEach((m) => {
      t += Number(m.time) || 0;
      const x = plotX0 + Math.min(t / (brewMinutes || 1), 1) * plotW;
      const y = plotY0 - ((Number(m.temp) || 0) / maxTemp) * plotH;
      pts.push(`${x},${y}`);
    });
    t += boilTime;
    pts.push(`${plotX0 + Math.min(t / (brewMinutes || 1), 1) * plotW},${plotY0 - (boilTemp / maxTemp) * plotH}`);
    return {
      points: pts.join(' '),
      maxTemp: Math.round(maxTemp),
      brewTimeLabel: fmtDuration(brewMinutes),
      chillTimeLabel: fmtDuration(chillMinutes),
    };
  }, [mashSteps, boilTime, boilTemp, batchSize]);

  const stepWarnings = useMemo(() => getPicoStepWarnings(machineSteps), [machineSteps]);
  const machineValidation = useMemo(
    () => validatePicoRecipe(machineSteps.map(({ id: _id, ...rest }) => rest)),
    [machineSteps],
  );
  const errors = useMemo(() => {
    const errs: string[] = [];
    if (!name.trim()) {
      errs.push('Recipe name is required');
    }
    if (mashSteps.length === 0) {
      errs.push('At least one mash step is required');
    }
    if (!yeastName.trim()) {
      errs.push('Yeast selection is required');
    }
    if (boilTime <= 0) {
      errs.push('Total boil time must be greater than 0');
    }
    errs.push(...machineValidation.errors);
    return errs;
  }, [name, mashSteps.length, yeastName, boilTime, machineValidation.errors]);
  const hasErrors = errors.length > 0;

  const isDirty = useMemo(
    () =>
      name !== initialSnapshotRef.current.name ||
      mashSteps.length !== initialSnapshotRef.current.mashStepsCount ||
      yeastName !== initialSnapshotRef.current.yeastName ||
      boilTime !== initialSnapshotRef.current.boilTime ||
      JSON.stringify(machineSteps.map(({ id: _id, ...rest }) => rest)) !== initialSnapshotRef.current.machineStepsJson,
    [name, mashSteps.length, yeastName, boilTime, machineSteps],
  );
  const blockingErrors = hasErrors && isDirty;

  const payload = useMemo(
    () => ({
      name,
      deviceType,
      packType: RecipePackType.ZPACK,
      abv,
      ibu,
      style,
      og,
      fg: fg ?? undefined,
      colorSRM: srm ?? undefined,
      notes,
      fermentDays: fermentDays === '' ? null : fermentDays,
      photoUrl: photoUrl ?? undefined,
      batchSize,
      mashType: Number(mashType),
      boilTime,
      boilTemp,
      firstWortHopping,
      fermentationType: Number(fermentationType),
      yeastName,
      yeastAttenuation,
      yeastRangeTemp,
      yeastPitchTemp,
      steps: machineSteps.map(({ id: _id, ...rest }) => rest),
      ingredients: [
        ...rowsToIngredients(amendments, IngredientSection.WATER, ['amount', 'unit'], weightUnit),
        ...rowsToIngredients(mashSteps, IngredientSection.MASH_STEP, ['temp', 'time'], weightUnit),
        ...rowsToIngredients(fermentables, IngredientSection.FERMENTABLE, ['amount', 'color'], weightUnit),
        ...rowsToIngredients(hops, IngredientSection.BOIL_HOP, ['amount', 'aa', 'time'], weightUnit),
        ...rowsToIngredients(otherBoil, IngredientSection.OTHER_BOIL, ['amount', 'unit', 'time'], weightUnit),
        ...rowsToIngredients(
          fermentationSteps,
          IngredientSection.FERMENTATION_STEP,
          ['temp', 'days', 'hours'],
          weightUnit,
        ),
        ...rowsToIngredients(dryHops, IngredientSection.DRY_HOP, ['amount', 'aa', 'time'], weightUnit),
      ],
    }),
    [
      name,
      deviceType,
      abv,
      ibu,
      style,
      og,
      fg,
      srm,
      notes,
      fermentDays,
      photoUrl,
      batchSize,
      mashType,
      boilTime,
      boilTemp,
      firstWortHopping,
      fermentationType,
      yeastName,
      yeastAttenuation,
      yeastRangeTemp,
      yeastPitchTemp,
      machineSteps,
      amendments,
      mashSteps,
      fermentables,
      hops,
      otherBoil,
      fermentationSteps,
      dryHops,
      weightUnit,
    ],
  );

  // The payload covers every field (unlike isDirty above, which only tracks what drives validation),
  // so it's the right yardstick for "has anything been edited that isn't saved yet".
  const initialPayloadJson = useRef<string | null>(null);
  if (initialPayloadJson.current === null) {
    initialPayloadJson.current = JSON.stringify(payload);
  }
  const hasUnsavedChanges = !readOnly && JSON.stringify(payload) !== initialPayloadJson.current;

  const FormWrapper = readOnly ? 'div' : Form;
  const formWrapperProps = readOnly
    ? {}
    : { id: RECIPE_FORM_ID, method: 'post' as const, encType: 'multipart/form-data' as const };

  return (
    <>
      <UnsavedChangesPrompt when={hasUnsavedChanges} />
      <div className="mb-1 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/recipes')}
          className="flex size-8 items-center justify-center rounded-[7px] border border-ink-card-border bg-ink-card"
        >
          <MdArrowBack className="size-[15px]" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2.5">
            <p className="truncate text-lg font-bold">{name || 'New Recipe'}</p>
            <Badge>ZPack</Badge>
          </div>
          <p className="text-xs text-ink-text-faint">{style || ' '}</p>
        </div>
        {readOnly && recipe && (
          <Link to={`/recipes/${recipe.id}?mode=edit`}>
            <Button variant="brand" size="sm">
              <MdEdit />
              Edit Recipe
            </Button>
          </Link>
        )}
        {readOnly && recipe && <RecipeActionsMenu recipe={{ id: recipe.id, name: recipe.name }} />}
        {!readOnly && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSubmitting}
            onClick={() => navigate(recipe ? `/recipes/${recipe.id}` : '/recipes')}
          >
            Cancel
          </Button>
        )}
        {!readOnly && (
          <Button type="submit" form={RECIPE_FORM_ID} variant="brand" size="sm" disabled={hasErrors || isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save Recipe'}
          </Button>
        )}
      </div>

      <FormWrapper {...formWrapperProps}>
        {!readOnly && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              name="photo"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setPhotoPreview(URL.createObjectURL(file));
                }
              }}
            />
            <input type="hidden" name="data" value={JSON.stringify(payload)} />
          </>
        )}

        <div className="flex max-w-[1040px] flex-col gap-4">
          {blockingErrors && !readOnly && (
            <div className="flex flex-col gap-1.5 rounded-[10px] border border-danger-500 bg-danger-100 p-3.5">
              <div className="flex items-center gap-2 text-[13px] font-bold text-danger-500">
                <MdError className="size-[15px]" />
                Fix these before saving
              </div>
              {errors.map((err) => (
                <p key={err} className="pl-[23px] text-[13px] text-ink-text-secondary">
                  {err}
                </p>
              ))}
            </div>
          )}

          {/* Overview */}
          <Card className="flex-col gap-[22px] p-[22px] md:flex-row">
            <button
              type="button"
              disabled={readOnly}
              onClick={readOnly ? undefined : () => fileInputRef.current?.click()}
              className={cn(
                'flex h-[220px] w-[180px] flex-none items-center justify-center overflow-hidden rounded-xl border border-dashed border-ink-border-strong bg-ink-bg bg-cover bg-center',
                readOnly ? 'cursor-default' : 'cursor-pointer',
              )}
              style={{ backgroundImage: `url(${photoPreview || srmSwatchUrl(srm) || '/img/no-photo.jpg'})` }}
            >
              {!photoPreview && !readOnly && (
                <div className="flex flex-col items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-2 text-ink-text">
                  <MdCameraAlt className="size-6" />
                  <p className="text-xs">Beer glass photo</p>
                </div>
              )}
            </button>
            <div className="flex min-w-[260px] flex-1 flex-col gap-3.5">
              <div>
                <p className="text-xl font-bold">{name || 'New Recipe'}</p>
                <p className="mt-0.5 text-[13px] text-ink-text-dim">{style || ' '}</p>
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))' }}>
                <OverviewStat
                  label="OG"
                  tip="Original gravity: how dense the wort is before fermentation starts. It is used to work out the expected final gravity; the fermentation chart's expected curve starts from the first Tilt reading."
                  value={og.toFixed(3)}
                  min={recipe?.ogMin?.toFixed(3)}
                  max={recipe?.ogMax?.toFixed(3)}
                  input={
                    readOnly ? undefined : (
                      <Input
                        type="number"
                        step={0.001}
                        value={og}
                        onChange={(e) => setOg(Number(e.target.value))}
                        className={cn(
                          'mt-1 h-[30px] border-ink-card-border bg-ink-bg font-mono font-bold',
                          dirtyClass(og, recipe?.og ?? 1.05, isEditingExisting),
                        )}
                      />
                    )
                  }
                />
                <OverviewStat
                  label="FG"
                  tip="Final gravity: where the gravity should end up when fermentation is finished. The chart's expected and projected gravity lines head toward it. Leave it blank and it is worked out from the yeast attenuation."
                  value={fg != null ? fg.toFixed(3) : '—'}
                  min={recipe?.fgMin?.toFixed(3)}
                  max={recipe?.fgMax?.toFixed(3)}
                  input={
                    readOnly ? undefined : (
                      <Input
                        type="number"
                        step={0.001}
                        value={fg ?? ''}
                        onChange={(e) => setFg(e.target.value === '' ? null : Number(e.target.value))}
                        className={cn(
                          'mt-1 h-[30px] border-ink-card-border bg-ink-bg font-mono font-bold',
                          dirtyClass(fg, recipe?.fg ?? null, isEditingExisting),
                        )}
                      />
                    )
                  }
                />
                <OverviewStat
                  label="IBU"
                  value={ibu}
                  min={recipe?.ibuMin?.toString()}
                  max={recipe?.ibuMax?.toString()}
                  input={
                    readOnly ? undefined : (
                      <Input
                        type="number"
                        value={ibu}
                        onChange={(e) => setIbu(Number(e.target.value))}
                        className={cn(
                          'mt-1 h-[30px] border-ink-card-border bg-ink-bg font-mono font-bold',
                          dirtyClass(ibu, recipe?.ibu ?? 30, isEditingExisting),
                        )}
                      />
                    )
                  }
                />
                <OverviewStat
                  label="SRM"
                  value={srm ?? '—'}
                  min={recipe?.srmMin?.toString()}
                  max={recipe?.srmMax?.toString()}
                  input={
                    readOnly ? undefined : (
                      <Input
                        type="number"
                        value={srm ?? ''}
                        onChange={(e) => setSrm(e.target.value === '' ? null : Number(e.target.value))}
                        className={cn(
                          'mt-1 h-[30px] border-ink-card-border bg-ink-bg font-mono font-bold',
                          dirtyClass(srm, recipe?.colorSRM ?? null, isEditingExisting),
                        )}
                      />
                    )
                  }
                />
                <OverviewStat
                  label="ABV %"
                  value={abv.toFixed(1)}
                  min={recipe?.abvMin?.toString()}
                  max={recipe?.abvMax?.toString()}
                />
              </div>
            </div>
          </Card>

          {/* Composition */}
          <Card className="gap-4 p-[22px]">
            <p className="text-[15px] font-bold">Composition</p>
            <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <div className="flex flex-col items-center gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.4px] text-ink-text-faint">Grain Bill</p>
                <div className="relative size-[120px] rounded-full" style={{ background: grain.background }}>
                  <div className="absolute inset-4 rounded-full bg-ink-card" />
                </div>
                <div className="flex flex-col gap-1">
                  {grain.legend.map((item) => (
                    <div key={item.label} className="flex items-center gap-1.5 text-xs text-ink-text-secondary">
                      <span className="size-[9px] shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-center gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.4px] text-ink-text-faint">Hop Bill</p>
                <div className="relative size-[120px] rounded-full" style={{ background: hopDonut.background }}>
                  <div className="absolute inset-4 rounded-full bg-ink-card" />
                </div>
                <div className="flex flex-col gap-1">
                  {hopDonut.legend.map((item) => (
                    <div key={item.label} className="flex items-center gap-1.5 text-xs text-ink-text-secondary">
                      <span className="size-[9px] shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-center gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.4px] text-ink-text-faint">Wort Curve</p>
                <svg width="100%" height="120px" viewBox="0 0 260 120" preserveAspectRatio="none">
                  <line x1={30} y1={10} x2={30} y2={100} stroke="oklch(0.3 0.01 260)" strokeWidth={1} />
                  <line x1={30} y1={100} x2={250} y2={100} stroke="oklch(0.3 0.01 260)" strokeWidth={1} />
                  <text x={4} y={14} fill="oklch(0.5 0.008 260)" fontSize={9}>
                    {wort.maxTemp}
                  </text>
                  <text x={12} y={103} fill="oklch(0.5 0.008 260)" fontSize={9}>
                    0
                  </text>
                  <polyline
                    points={wort.points}
                    fill="none"
                    stroke="oklch(0.78 0.135 65)"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />
                </svg>
                <p className="text-center text-xs text-ink-text-secondary">
                  Brew Time (Est.): <b className="text-ink-text">{wort.brewTimeLabel}</b>
                  <br />
                  Chill Time (Est.): <b className="text-ink-text">{wort.chillTimeLabel}</b>
                </p>
              </div>
            </div>
          </Card>

          {/* Recipe Details */}
          <Card className="gap-3.5 p-[22px]">
            <p className="text-[15px] font-bold">Recipe Details</p>
            <div className="flex flex-wrap gap-3.5">
              <div className="min-w-[200px] flex-1">
                <FieldLabel>Recipe Name *</FieldLabel>
                {readOnly ? (
                  <FieldValue>{name}</FieldValue>
                ) : (
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={dirtyClass(name, recipe?.name ?? '', isEditingExisting)}
                  />
                )}
              </div>
              <div className="min-w-[200px] flex-1">
                <FieldLabel>Style</FieldLabel>
                {readOnly ? (
                  <FieldValue>{style || '—'}</FieldValue>
                ) : (
                  <StyleSelect
                    value={style}
                    onChange={setStyle}
                    className={dirtyClass(style, recipe?.style ?? '', isEditingExisting)}
                  />
                )}
              </div>
              <div className="w-[170px]">
                <FieldLabel tip="How long fermentation should run for this recipe. It sets the fermentation chart's default date range and the time remaining; a batch can be extended later with Ferment longer.">
                  Fermentation (days)
                </FieldLabel>
                {readOnly ? (
                  <FieldValue>{fermentDays === '' ? '—' : fermentDays}</FieldValue>
                ) : (
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    placeholder="Optional"
                    title="Optional. Sets the default date range of the fermentation chart."
                    value={fermentDays}
                    onChange={(e) =>
                      setFermentDays(e.target.value === '' ? '' : Math.max(1, Math.round(Number(e.target.value))))
                    }
                    className={dirtyClass(fermentDays, recipe?.fermentDays ?? '', isEditingExisting)}
                  />
                )}
              </div>
            </div>
            <div>
              <FieldLabel>Notes</FieldLabel>
              {readOnly ? (
                <FieldValue>{notes || '—'}</FieldValue>
              ) : (
                <Textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={cn('resize-y', dirtyClass(notes, recipe?.notes ?? '', isEditingExisting))}
                />
              )}
            </div>
          </Card>

          {/* Water */}
          <Card className="gap-3.5 p-[22px]">
            <p className="text-[15px] font-bold">Water</p>
            <div className="flex flex-wrap gap-3.5">
              <div className="min-w-[160px] flex-1">
                <FieldLabel>Batch Size (Gal)</FieldLabel>
                {readOnly ? (
                  <FieldValue mono>{batchSize}</FieldValue>
                ) : (
                  <Input
                    type="number"
                    step={0.1}
                    value={batchSize}
                    onChange={(e) => setBatchSize(Number(e.target.value))}
                    className={cn('font-mono', dirtyClass(batchSize, recipe?.batchSize ?? 2.5, isEditingExisting))}
                  />
                )}
              </div>
              <div className="min-w-[160px] flex-1">
                <FieldLabel>Starting Water (Gal)</FieldLabel>
                <p className="px-2.5 py-2 font-mono text-[13px] text-ink-text-muted">{startingWater}</p>
              </div>
            </div>
            {(!readOnly || amendments.length > 0) && (
              <div>
                <SectionLabel>Water Amendments</SectionLabel>
                <EditableRowList
                  rows={amendments}
                  templateColumns="1.5fr 1fr 1fr"
                  columns={[
                    { key: 'name', label: 'Name', type: 'text', placeholder: 'Gypsum' },
                    { key: 'amount', label: 'Amount', type: 'number', step: 0.1 },
                    { key: 'unit', label: 'Units', type: 'text', placeholder: 'g' },
                  ]}
                  onChange={amendmentActions.onChange}
                  onAdd={() => amendmentActions.onAdd({ unit: 'g' })}
                  onRemove={amendmentActions.onRemove}
                  addLabel="Add Water Amendment"
                  readOnly={readOnly}
                />
              </div>
            )}
          </Card>

          {/* Mash & Fermentables */}
          <Card className="gap-4 p-[22px]">
            <p className="text-[15px] font-bold">Mash &amp; Fermentables</p>
            <div className="max-w-[220px]">
              <FieldLabel>Mash Type</FieldLabel>
              {readOnly ? (
                <FieldValue>{MASH_TYPE_LABELS[mashType] ?? mashType}</FieldValue>
              ) : (
                <Select value={mashType} onChange={(e) => setMashType(e.target.value)}>
                  <option value="0">Single Step Infusion</option>
                  <option value="3">Single Step Infusion With Mash Out</option>
                  <option value="1">High Efficiency Multi Step</option>
                  <option value="2">Custom</option>
                </Select>
              )}
            </div>
            {(!readOnly || mashSteps.length > 0) && (
              <div>
                <SectionLabel>Mash Steps</SectionLabel>
                <EditableRowList
                  rows={mashSteps}
                  templateColumns="1.6fr 0.9fr 0.9fr"
                  columns={[
                    { key: 'name', label: 'Step', type: 'text' },
                    { key: 'temp', label: 'Temp °F', type: 'number' },
                    { key: 'time', label: 'Time (min)', type: 'number' },
                  ]}
                  onChange={mashStepActions.onChange}
                  onAdd={() => mashStepActions.onAdd({ name: 'New Step', temp: 152, time: 20 })}
                  onRemove={mashStepActions.onRemove}
                  addLabel="Add Mash Step"
                  minRows={1}
                  readOnly={readOnly}
                />
              </div>
            )}
            {(!readOnly || fermentables.length > 0) && (
              <div>
                <SectionLabel>Fermentables</SectionLabel>
                <EditableRowList
                  rows={fermentables}
                  templateColumns="1.6fr 0.9fr 0.9fr"
                  columns={[
                    { key: 'name', label: 'Ingredient', type: 'text' },
                    { key: 'amount', label: 'Amount (lbs)', type: 'number', step: 0.1 },
                    { key: 'color', label: 'Color (pts)', type: 'number' },
                  ]}
                  onChange={fermentableActions.onChange}
                  onAdd={() => fermentableActions.onAdd({ amount: 1, color: 2 })}
                  onRemove={fermentableActions.onRemove}
                  addLabel="Add Fermentable"
                  readOnly={readOnly}
                />
              </div>
            )}
          </Card>

          {/* Boil */}
          <Card className="gap-4 p-[22px]">
            <p className="text-[15px] font-bold">Boil</p>
            <div className="flex flex-wrap gap-3.5">
              <div className="min-w-[160px] flex-1">
                <FieldLabel>Total Boil Time (min)</FieldLabel>
                {readOnly ? (
                  <FieldValue mono>{boilTime}</FieldValue>
                ) : (
                  <Input
                    type="number"
                    value={boilTime}
                    onChange={(e) => setBoilTime(Number(e.target.value))}
                    className={cn('font-mono', dirtyClass(boilTime, recipe?.boilTime ?? 60, isEditingExisting))}
                  />
                )}
              </div>
              <div className="min-w-[160px] flex-1">
                <FieldLabel>Boil Temp °F</FieldLabel>
                {readOnly ? (
                  <FieldValue mono>{boilTemp}</FieldValue>
                ) : (
                  <Input
                    type="number"
                    value={boilTemp}
                    onChange={(e) => setBoilTemp(Number(e.target.value))}
                    className={cn('font-mono', dirtyClass(boilTemp, recipe?.boilTemp ?? 207, isEditingExisting))}
                  />
                )}
              </div>
              <div className="min-w-[180px] flex-1">
                <FieldLabel>First Wort Hopping</FieldLabel>
                {readOnly ? (
                  <FieldValue>{firstWortHopping ? 'Enabled' : 'Disabled'}</FieldValue>
                ) : (
                  <div className="mt-1.5 flex items-center gap-2">
                    <Checkbox
                      checked={firstWortHopping}
                      onCheckedChange={(checked) => setFirstWortHopping(checked === true)}
                    />
                    <p className="text-[13px] text-ink-text-secondary">Enabled</p>
                  </div>
                )}
              </div>
            </div>
            {(!readOnly || hops.length > 0) && (
              <div>
                <SectionLabel>Hops</SectionLabel>
                <EditableRowList
                  rows={hops}
                  templateColumns="1.4fr 0.8fr 0.7fr 0.8fr"
                  columns={[
                    { key: 'name', label: 'Type', type: 'text' },
                    { key: 'amount', label: `Amount (${weightUnit})`, type: 'number', step: 0.1 },
                    { key: 'aa', label: 'AA%', type: 'number', step: 0.1 },
                    { key: 'time', label: 'Time (min)', type: 'number' },
                  ]}
                  onChange={hopActions.onChange}
                  onAdd={() => hopActions.onAdd({ amount: 1, aa: 5, time: 15 })}
                  onRemove={hopActions.onRemove}
                  addLabel="Add Hop"
                  readOnly={readOnly}
                />
              </div>
            )}
            {(!readOnly || otherBoil.length > 0) && (
              <div>
                <SectionLabel>Other Boil Ingredients</SectionLabel>
                <EditableRowList
                  rows={otherBoil}
                  templateColumns="1.4fr 0.8fr 0.7fr 0.8fr"
                  columns={[
                    { key: 'name', label: 'Name', type: 'text', placeholder: 'Irish Moss' },
                    { key: 'amount', label: 'Amount', type: 'number', step: 0.1 },
                    { key: 'unit', label: 'Units', type: 'text', placeholder: 'tsp' },
                    { key: 'time', label: 'Time (min)', type: 'number' },
                  ]}
                  onChange={otherBoilActions.onChange}
                  onAdd={() => otherBoilActions.onAdd({ amount: 1, unit: 'tsp', time: 10 })}
                  onRemove={otherBoilActions.onRemove}
                  addLabel="Add Ingredient"
                  readOnly={readOnly}
                />
              </div>
            )}
          </Card>

          {/* Fermentation */}
          <Card className="gap-4 p-[22px]">
            <p className="text-[15px] font-bold">Fermentation</p>
            <div className="max-w-[220px]">
              <FieldLabel tip="Ale or lager. When the yeast has no temperature range set, the chart's recommended range falls back to a typical one for this type (ale 64-72°F, lager 46-58°F).">
                Fermentation Type
              </FieldLabel>
              {readOnly ? (
                <FieldValue>{FERMENTATION_TYPE_LABELS[fermentationType] ?? fermentationType}</FieldValue>
              ) : (
                <Select value={fermentationType} onChange={(e) => setFermentationType(e.target.value)}>
                  <option value="0">Ale</option>
                  <option value="1">Lager</option>
                  <option value="2">Advanced / Custom</option>
                </Select>
              )}
            </div>
            <div>
              <SectionLabel>Yeast</SectionLabel>
              <div className="grid gap-2" style={{ gridTemplateColumns: '1.6fr 0.9fr 0.9fr 0.9fr' }}>
                <div>
                  <p className="mb-1 text-[10px] text-ink-text-faintest">Name</p>
                  {readOnly ? (
                    <FieldValue>{yeastName || '—'}</FieldValue>
                  ) : (
                    <Input
                      value={yeastName}
                      onChange={(e) => setYeastName(e.target.value)}
                      className={cn('text-[13px]', dirtyClass(yeastName, recipe?.yeastName ?? '', isEditingExisting))}
                    />
                  )}
                </div>
                <div>
                  <SubLabel tip="How much of the wort's sugar the yeast is expected to ferment (apparent attenuation). Used to work out the final gravity when it is not set.">
                    Expected Attenuation %
                  </SubLabel>
                  {readOnly ? (
                    <FieldValue mono>{yeastAttenuation}</FieldValue>
                  ) : (
                    <Input
                      type="number"
                      value={yeastAttenuation}
                      onChange={(e) => setYeastAttenuation(Number(e.target.value))}
                      className={cn(
                        'font-mono text-[13px]',
                        dirtyClass(yeastAttenuation, recipe?.yeastAttenuation ?? 75, isEditingExisting),
                      )}
                    />
                  )}
                </div>
                <div>
                  <SubLabel tip="The fermentation temperature range that suits this yeast, written min-max in °F (for example 64-72). It draws the recommended range on the fermentation chart, and the AI advice tells you if you are outside it.">
                    Range Temp °F
                  </SubLabel>
                  {readOnly ? (
                    <FieldValue mono>{yeastRangeTemp || '—'}</FieldValue>
                  ) : (
                    <Input
                      value={yeastRangeTemp}
                      onChange={(e) => setYeastRangeTemp(e.target.value)}
                      className={cn(
                        'font-mono text-[13px]',
                        dirtyClass(yeastRangeTemp, recipe?.yeastRangeTemp ?? '', isEditingExisting),
                      )}
                      placeholder="64 - 82"
                    />
                  )}
                </div>
                <div>
                  <SubLabel tip="The wort temperature to add the yeast at, in °F. Cool the wort to about this before pitching; the AI Brewmaster uses it as context.">
                    Pitch Temp °F
                  </SubLabel>
                  {readOnly ? (
                    <FieldValue mono>{yeastPitchTemp}</FieldValue>
                  ) : (
                    <Input
                      type="number"
                      value={yeastPitchTemp}
                      onChange={(e) => setYeastPitchTemp(Number(e.target.value))}
                      className={cn(
                        'font-mono text-[13px]',
                        dirtyClass(yeastPitchTemp, recipe?.yeastPitchTemp ?? 65, isEditingExisting),
                      )}
                    />
                  )}
                </div>
              </div>
            </div>
            {(!readOnly || fermentationSteps.length > 0) && (
              <div>
                <SectionLabel>Fermentation Steps</SectionLabel>
                <EditableRowList
                  rows={fermentationSteps}
                  templateColumns="1.6fr 0.8fr 0.7fr 0.7fr"
                  columns={[
                    { key: 'name', label: 'Step', type: 'text' },
                    { key: 'temp', label: 'Temp °F', type: 'number' },
                    { key: 'days', label: 'Days', type: 'number' },
                    { key: 'hours', label: 'Hours', type: 'number' },
                  ]}
                  onChange={fermentationStepActions.onChange}
                  onAdd={() => fermentationStepActions.onAdd({ name: 'New Step', temp: 65, days: 1, hours: 0 })}
                  onRemove={fermentationStepActions.onRemove}
                  addLabel="Add Fermentation Step"
                  readOnly={readOnly}
                />
              </div>
            )}
            {(!readOnly || dryHops.length > 0) && (
              <div>
                <SectionLabel>Dry Hops</SectionLabel>
                <EditableRowList
                  rows={dryHops}
                  templateColumns="1.4fr 0.8fr 0.7fr 0.8fr"
                  columns={[
                    { key: 'name', label: 'Type', type: 'text' },
                    { key: 'amount', label: `Amount (${weightUnit})`, type: 'number', step: 0.1 },
                    { key: 'aa', label: 'AA%', type: 'number', step: 0.1 },
                    { key: 'time', label: 'Time (days)', type: 'number' },
                  ]}
                  onChange={dryHopActions.onChange}
                  onAdd={() => dryHopActions.onAdd({ amount: 1, aa: 5, time: 3 })}
                  onRemove={dryHopActions.onRemove}
                  addLabel="Add Hop"
                  readOnly={readOnly}
                />
              </div>
            )}
          </Card>

          {/* Machine Steps */}
          <Card className="gap-3.5 p-[22px]">
            <button
              type="button"
              onClick={() => setMachineStepsExpanded((v) => !v)}
              className="flex items-center gap-2 text-left"
            >
              <MdExpandMore
                className={cn(
                  'size-[18px] text-ink-text-faint transition-transform duration-150',
                  machineStepsExpanded ? 'rotate-0' : '-rotate-90',
                )}
              />
              <p className="text-[15px] font-bold">Machine Steps</p>
            </button>
            <StepRangeWarnings warnings={stepWarnings} />
            {machineStepsExpanded && (
              <div className="overflow-hidden rounded-[10px] border border-ink-divider">
                <div
                  className="grid gap-2.5 bg-ink-bg px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.4px] text-ink-text-faint"
                  style={{ gridTemplateColumns: '1.7fr 1fr 0.8fr 0.8fr 0.8fr' }}
                >
                  <span>Name</span>
                  <span>Location</span>
                  <span>Temp °F</span>
                  <span>Time (min)</span>
                  <span>Drain (min)</span>
                </div>
                {machineSteps.map((row, index) => {
                  const originalStep = recipe?.steps?.[index];
                  return (
                    <div
                      key={row.id}
                      className={cn(
                        'grid items-center gap-2.5 px-3.5 py-[9px] text-[13px]',
                        index > 0 && 'border-t border-ink-divider',
                      )}
                      style={{ gridTemplateColumns: '1.7fr 1fr 0.8fr 0.8fr 0.8fr' }}
                    >
                      <p className={dirtyClass(row.name, originalStep?.name, isEditingExisting)}>{row.name}</p>
                      <p
                        className={cn(
                          'text-ink-text-muted',
                          dirtyClass(row.location, originalStep?.location, isEditingExisting),
                        )}
                      >
                        {PicoLocationMap[row.location]}
                      </p>
                      <p
                        className={cn(
                          'font-mono',
                          dirtyClass(row.temperature, originalStep?.temperature, isEditingExisting),
                        )}
                      >
                        {row.temperature}
                      </p>
                      <p
                        className={cn('font-mono', dirtyClass(row.stepTime, originalStep?.stepTime, isEditingExisting))}
                      >
                        {row.stepTime}
                      </p>
                      <p
                        className={cn(
                          'font-mono',
                          dirtyClass(row.drainTime, originalStep?.drainTime, isEditingExisting),
                        )}
                      >
                        {row.drainTime}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
            {!readOnly && (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="self-start text-[13px] font-semibold text-brand-500"
              >
                Edit Machine Steps
              </button>
            )}
          </Card>
          <p className="px-1 text-[11px] text-ink-text-faintest">
            Firmware program run by the Pico. Step times are subject to change when compensating for lower boil temp.
          </p>
        </div>
      </FormWrapper>

      {!readOnly && (
        <MachineStepsModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          steps={machineSteps}
          onChange={setMachineSteps}
        />
      )}
    </>
  );
};
