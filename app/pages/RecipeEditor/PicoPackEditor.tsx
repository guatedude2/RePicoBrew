import { Form, Link, useNavigate, useNavigation } from 'react-router';
import { useEffect, useMemo, useRef, useState, type FC } from 'react';
import { MdArrowBack, MdCameraAlt, MdEdit, MdError, MdExpandMore } from 'react-icons/md';
import { useRegisterAiRecipeBridge } from '~/components/recipes/AiSidekickContext';
import { UnsavedChangesPrompt } from '~/components/UnsavedChangesPrompt';
import { RecipeActionsMenu } from '~/components/recipes/RecipeActionsMenu';
import { StyleSelect } from '~/components/recipe-editor/StyleSelect';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { EditableRowList } from '~/components/recipe-editor/EditableRowList';
import { HopCompartmentInfo } from '~/components/recipe-editor/HopCompartmentInfo';
import { StepRangeWarnings } from '~/components/recipe-editor/StepRangeWarnings';
import { getPicoStepWarnings } from '~/utils/pico-step-ranges';
import { MachineStepsModal, type MachineStepRow } from '~/components/recipe-editor/MachineStepsModal';
import { cn } from '~/lib/utils';
import type { AiIngredientRow, PicoPackAiRecipe } from '~/services/ai-recipe-generator.server';
import { IngredientSection, PicoLocationMap, RecipePackType } from '~/types';
import { dirtyClass } from '~/utils/form-dirty';
import { validatePicoRecipe } from '~/utils/pico-recipe-validation';
import { displayToOz, ozToDisplay, useWeightUnit, type WeightUnit } from '~/utils/weight-unit';
import type { RecipeEditorIngredient } from './index';

const RECIPE_FORM_ID = 'recipe-form';

const newId = () => Math.random().toString(36).slice(2);

// What goes into the pak: grain in the main compartment, hops in the numbered hop compartments.
// Listed for the person filling the physical pak — the machine itself only runs the steps below.
type PakRow = { id: string; name: string; amount?: number; aa?: number; compartment?: string };

// A PicoPak has four hop compartments; each drops into the boil at its own hop step (step locations
// Adjunct1-4). Stored on the ingredient's `unit` column, which nothing else uses for hops here.
const HOP_COMPARTMENTS = ['Adjunct1', 'Adjunct2', 'Adjunct3', 'Adjunct4'];
const nextFreeCompartment = (rows: PakRow[]) =>
  HOP_COMPARTMENTS.find((c) => !rows.some((r) => r.compartment === c)) ?? HOP_COMPARTMENTS[0];

// Hops saved before compartments existed (or drafted without one) get the first free compartments, in order.
const withCompartments = (rows: PakRow[]): PakRow[] => {
  const used = new Set<string>();
  const kept = rows.map((row) => {
    if (row.compartment && HOP_COMPARTMENTS.includes(row.compartment) && !used.has(row.compartment)) {
      used.add(row.compartment);
      return row;
    }
    return { ...row, compartment: undefined };
  });
  return kept.map((row) => {
    if (row.compartment) {
      return row;
    }
    const free = HOP_COMPARTMENTS.find((c) => !used.has(c)) ?? HOP_COMPARTMENTS[HOP_COMPARTMENTS.length - 1];
    used.add(free);
    return { ...row, compartment: free };
  });
};

// Every PicoPack ingredient amount (grain and hop alike) is stored in ounces regardless of the
// display setting — these two only convert at the UI boundary (see ~/utils/weight-unit).
const pakRowsFor = (
  ingredients: RecipeEditorIngredient[] | undefined,
  section: IngredientSection,
  weightUnit: WeightUnit,
): PakRow[] => {
  const rows = (ingredients ?? [])
    .filter((i) => i.section === section)
    .map((i) => ({
      id: newId(),
      name: i.name,
      amount: i.amount != null ? ozToDisplay(i.amount, weightUnit) : undefined,
      aa: i.aa ?? undefined,
      compartment: section === IngredientSection.BOIL_HOP ? i.unit ?? undefined : undefined,
    }));
  return section === IngredientSection.BOIL_HOP ? withCompartments(rows) : rows;
};

const aiRowToPakRow = (r: AiIngredientRow, weightUnit: WeightUnit): PakRow => ({
  id: newId(),
  name: r.name,
  amount: r.amount !== undefined ? ozToDisplay(r.amount, weightUnit) : undefined,
  aa: r.aa,
  compartment: r.compartment,
});

const pakRowsToIngredients = (
  rows: PakRow[],
  section: IngredientSection,
  weightUnit: WeightUnit,
): RecipeEditorIngredient[] =>
  rows
    .filter((r) => r.name.trim() !== '')
    .map((r) => ({
      section,
      name: r.name,
      amount: r.amount != null ? displayToOz(r.amount, weightUnit) : null,
      unit: section === IngredientSection.BOIL_HOP ? r.compartment ?? null : null,
      color: null,
      aa: section === IngredientSection.BOIL_HOP ? r.aa ?? null : null,
      time: null,
      temp: null,
      days: null,
      hours: null,
    }));

const stripPakRowIds = (rows: PakRow[]) => rows.map(({ id: _id, ...rest }) => rest);

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

// PicoPacks run a fixed 5L batch — there's no batch-size field to edit, unlike ZPack.
const PICOPACK_BATCH_SIZE_L = 5;
export const PICOPACK_BATCH_SIZE_GAL = PICOPACK_BATCH_SIZE_L / 3.78541;

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

export type PicoPackEditorData = {
  id: number;
  name: string;
  style: string | null;
  notes: string | null;
  photoUrl: string | null;
  abv: number;
  ibu: number;
  yeastName?: string | null;
  yeastAmount?: number | null;
  steps: Array<{ name: string; temperature: number; stepTime: number; drainTime: number; location: number }>;
  ingredients?: RecipeEditorIngredient[];
};

export const PicoPackEditor: FC<{ recipe?: PicoPackEditorData; deviceType: string; readOnly?: boolean }> = ({
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

  const [name, setName] = useState(recipe?.name ?? '');
  const [style, setStyle] = useState(recipe?.style ?? '');
  const [notes, setNotes] = useState(recipe?.notes ?? '');
  const [abv, setAbv] = useState(recipe?.abv ?? 5);
  const [ibu, setIbu] = useState(recipe?.ibu ?? 30);
  // Almost every official PicoPak ships with a single 2g dry yeast packet — that's the default for
  // a new recipe, not a guess at any particular strain.
  const [yeastName, setYeastName] = useState(recipe?.yeastName ?? '');
  const [yeastAmount, setYeastAmount] = useState(recipe?.yeastAmount ?? 2);
  const [photoUrl] = useState(recipe?.photoUrl ?? null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(recipe?.photoUrl ?? null);

  const [machineSteps, setMachineSteps] = useState<MachineStepRow[]>(
    recipe?.steps?.length ? recipe.steps.map(machineStepToRow) : DEFAULT_MACHINE_STEPS,
  );
  const [grains, setGrains] = useState<PakRow[]>(() =>
    pakRowsFor(recipe?.ingredients, IngredientSection.FERMENTABLE, weightUnit),
  );
  const [hops, setHops] = useState<PakRow[]>(() =>
    pakRowsFor(recipe?.ingredients, IngredientSection.BOIL_HOP, weightUnit),
  );
  const pakRowActions = (setter: (fn: (rows: PakRow[]) => PakRow[]) => void) => ({
    onChange: (id: string, key: keyof PakRow, value: string | number) =>
      setter((rows) => rows.map((r) => (r.id === id ? { ...r, [key]: value } : r))),
    onAdd: (template: Partial<PakRow> = {}) => setter((rows) => [...rows, { id: newId(), name: '', ...template }]),
    onRemove: (id: string) => setter((rows) => rows.filter((r) => r.id !== id)),
  });
  const grainActions = pakRowActions(setGrains);
  const hopActions = pakRowActions(setHops);
  const [modalOpen, setModalOpen] = useState(false);
  const [stepsExpanded, setStepsExpanded] = useState(true);

  // What the form looked like on mount — for a new recipe that's the blank defaults, for an
  // existing one it's what was loaded. Diffing against this (rather than validating from the
  // very first render) is what lets an empty "Recipe name is required" stay quiet until the user
  // has actually started filling the form in.
  const initialSnapshot = useRef(
    JSON.stringify({
      name: recipe?.name ?? '',
      style: recipe?.style ?? '',
      notes: recipe?.notes ?? '',
      abv: recipe?.abv ?? 5,
      ibu: recipe?.ibu ?? 30,
      yeastName: recipe?.yeastName ?? '',
      yeastAmount: recipe?.yeastAmount ?? 2,
      steps: (recipe?.steps?.length ? recipe.steps.map(machineStepToRow) : DEFAULT_MACHINE_STEPS).map(
        ({ id: _id, ...rest }) => rest,
      ),
      grains: stripPakRowIds(pakRowsFor(recipe?.ingredients, IngredientSection.FERMENTABLE, weightUnit)),
      hops: stripPakRowIds(pakRowsFor(recipe?.ingredients, IngredientSection.BOIL_HOP, weightUnit)),
    }),
  ).current;
  const isDirty = useMemo(
    () =>
      JSON.stringify({
        name,
        style,
        notes,
        abv,
        ibu,
        yeastName,
        yeastAmount,
        steps: machineSteps.map(({ id: _id, ...rest }) => rest),
        grains: stripPakRowIds(grains),
        hops: stripPakRowIds(hops),
      }) !== initialSnapshot,
    [name, style, notes, abv, ibu, yeastName, yeastAmount, machineSteps, grains, hops, initialSnapshot],
  );

  // Pre-fills the in-progress form from an AI Brewmaster draft — mirrors how a manual edit would
  // set each field. Never auto-saves; the user still reviews and hits Save Recipe themselves.
  const handleAiGenerated = (aiRecipe: PicoPackAiRecipe) => {
    setName(aiRecipe.name);
    if (aiRecipe.style) {
      setStyle(aiRecipe.style);
    }
    if (aiRecipe.notes) {
      setNotes(aiRecipe.notes);
    }
    setAbv(aiRecipe.abv);
    setIbu(aiRecipe.ibu);
    if (aiRecipe.yeastName) {
      setYeastName(aiRecipe.yeastName);
    }
    if (aiRecipe.yeastAmount !== undefined) {
      setYeastAmount(aiRecipe.yeastAmount);
    }
    setMachineSteps(aiRecipe.steps.map(machineStepToRow));
    if (aiRecipe.grains) {
      setGrains(aiRecipe.grains.map((r) => aiRowToPakRow(r, weightUnit)));
    }
    if (aiRecipe.hops) {
      setHops(withCompartments(aiRecipe.hops.map((r) => aiRowToPakRow(r, weightUnit))));
    }
    setStepsExpanded(true);
  };

  // What the sidekick sends back as "the current recipe" for a "tweak this" edit request — kept
  // in sync with every field the AI can touch, same shape as a fresh generation returns.
  const currentAiRecipe: PicoPackAiRecipe = useMemo(
    () => ({
      name,
      style,
      abv,
      ibu,
      notes,
      yeastName,
      yeastAmount,
      steps: machineSteps.map(({ id: _id, ...rest }) => rest),
      grains: grains.map(({ id: _id, amount, ...rest }) => ({
        ...rest,
        amount: amount != null ? displayToOz(amount, weightUnit) : amount,
      })),
      hops: hops.map(({ id: _id, amount, ...rest }) => ({
        ...rest,
        amount: amount != null ? displayToOz(amount, weightUnit) : amount,
      })),
    }),
    [name, style, abv, ibu, notes, yeastName, yeastAmount, machineSteps, grains, hops, weightUnit],
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
      const draft = JSON.parse(raw) as { packType?: string; recipe?: PicoPackAiRecipe };
      if (draft.packType === 'picopack' && draft.recipe) {
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
          packType: 'picopack',
          hasContent: Boolean(name.trim()),
          recipeLabel: name.trim() || 'New Recipe',
          currentRecipe: currentAiRecipe,
          onGenerated: (r) => handleAiGenerated(r as PicoPackAiRecipe),
        },
  );

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
    const used = hops.filter((h) => h.name.trim()).map((h) => h.compartment);
    if (new Set(used).size !== used.length) {
      errs.push('Each hop needs its own compartment (Adjunct 1-4)');
    }
    errs.push(...machineValidation.errors);
    return errs;
  }, [name, hops, machineValidation.errors]);
  const hasErrors = errors.length > 0;

  const payload = useMemo(
    () => ({
      name,
      deviceType,
      packType: RecipePackType.PICOPACK,
      abv,
      ibu,
      style,
      notes,
      yeastName: yeastName.trim() || undefined,
      yeastAmount,
      photoUrl: photoUrl ?? undefined,
      batchSize: PICOPACK_BATCH_SIZE_GAL,
      steps: machineSteps.map(({ id: _id, ...rest }) => rest),
      ingredients: [
        ...pakRowsToIngredients(grains, IngredientSection.FERMENTABLE, weightUnit),
        ...pakRowsToIngredients(hops, IngredientSection.BOIL_HOP, weightUnit),
      ],
    }),
    [
      name,
      deviceType,
      abv,
      ibu,
      style,
      notes,
      yeastName,
      yeastAmount,
      photoUrl,
      machineSteps,
      grains,
      hops,
      weightUnit,
    ],
  );

  const FormWrapper = readOnly ? 'div' : Form;
  const formWrapperProps = readOnly
    ? {}
    : { id: RECIPE_FORM_ID, method: 'post' as const, encType: 'multipart/form-data' as const };

  return (
    <>
      <UnsavedChangesPrompt when={!readOnly && isDirty} />
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
            <Badge>PicoPack</Badge>
          </div>
          <p className="text-xs text-ink-text-faint">{style || ' '}</p>
        </div>
        {readOnly && recipe && (
          <Link to={`/recipes/${recipe.id}`}>
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

        <div className="flex max-w-[720px] flex-col gap-4">
          {hasErrors && !readOnly && isDirty && (
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

          <Card className="flex-col gap-[22px] p-[22px] md:flex-row">
            <button
              type="button"
              disabled={readOnly}
              onClick={readOnly ? undefined : () => fileInputRef.current?.click()}
              className={cn(
                'flex h-[220px] w-[180px] flex-none items-center justify-center overflow-hidden rounded-xl border border-dashed border-ink-border-strong bg-ink-bg bg-cover bg-center',
                readOnly ? 'cursor-default' : 'cursor-pointer',
              )}
              style={{ backgroundImage: `url(${photoPreview || '/img/no-photo.jpg'})` }}
            >
              {!photoPreview && !readOnly && (
                <div className="flex flex-col items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-2 text-ink-text">
                  <MdCameraAlt className="size-6" />
                  <p className="text-xs">Beer glass photo</p>
                </div>
              )}
            </button>
            <div className="flex min-w-[260px] flex-1 flex-col gap-3.5">
              {readOnly ? (
                <div>
                  <p className="text-xl font-bold">{name}</p>
                  <p className="mt-0.5 text-[13px] text-ink-text-dim">{style}</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3.5">
                  <div className="min-w-[200px] flex-1">
                    <p className="mb-1.5 text-[11px] font-semibold text-ink-text-secondary">Recipe Name *</p>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Plinius Maximus DIPA"
                      className={dirtyClass(name, recipe?.name ?? '', isEditingExisting)}
                    />
                  </div>
                  <div className="min-w-[200px] flex-1">
                    <p className="mb-1.5 text-[11px] font-semibold text-ink-text-secondary">Style</p>
                    <StyleSelect
                      value={style}
                      onChange={setStyle}
                      className={dirtyClass(style, recipe?.style ?? '', isEditingExisting)}
                    />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase text-ink-text-faint">ABV %</p>
                  {readOnly ? (
                    <p className="mt-1 px-2.5 py-2 font-mono text-sm font-bold">{abv.toFixed(1)}</p>
                  ) : (
                    <Input
                      type="number"
                      step={0.1}
                      value={abv}
                      onChange={(e) => setAbv(Number(e.target.value))}
                      className={cn(
                        'mt-1 h-[30px] border-ink-card-border bg-ink-bg font-mono font-bold',
                        dirtyClass(abv, recipe?.abv ?? 5, isEditingExisting),
                      )}
                    />
                  )}
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase text-ink-text-faint">IBU</p>
                  {readOnly ? (
                    <p className="mt-1 px-2.5 py-2 font-mono text-sm font-bold">{ibu}</p>
                  ) : (
                    <Input
                      type="number"
                      value={ibu}
                      onChange={(e) => setIbu(Number(e.target.value))}
                      className={cn(
                        'mt-1 h-[30px] border-ink-card-border bg-ink-bg font-mono font-bold',
                        dirtyClass(ibu, recipe?.ibu ?? 30, isEditingExisting),
                      )}
                    />
                  )}
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase text-ink-text-faint">Batch Size</p>
                  <p className="mt-1 px-2.5 py-2 font-mono text-sm font-bold text-ink-text-muted">
                    {PICOPACK_BATCH_SIZE_L} L (fixed)
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="gap-3.5 p-[22px]">
            <p className="text-[15px] font-bold">Notes</p>
            {readOnly ? (
              <p className="text-sm text-ink-text-secondary">{notes || '—'}</p>
            ) : (
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className={dirtyClass(notes, recipe?.notes ?? '', isEditingExisting)}
              />
            )}
          </Card>

          {(!readOnly || grains.length > 0 || hops.length > 0) && (
            <Card className="gap-4 p-[22px]">
              <div>
                <p className="text-[15px] font-bold">Pak Contents</p>
                <p className="mt-1 text-[12px] text-ink-text-faint">
                  What to load into the PicoPak — grain in the main compartment, one hop in each of the four hop
                  compartments (Adjunct 1-4), and the yeast packet.
                </p>
              </div>
              {(!readOnly || grains.length > 0) && (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.4px] text-ink-text-faint">Grains</p>
                  <EditableRowList
                    rows={grains}
                    templateColumns="1.6fr 0.9fr"
                    columns={[
                      { key: 'name', label: 'Grain', type: 'text' },
                      { key: 'amount', label: `Amount (${weightUnit})`, type: 'number', step: 0.1 },
                    ]}
                    onChange={grainActions.onChange}
                    onAdd={() => grainActions.onAdd({ amount: ozToDisplay(16, weightUnit) })}
                    onRemove={grainActions.onRemove}
                    addLabel="Add Grain"
                    readOnly={readOnly}
                  />
                </div>
              )}
              {(!readOnly || hops.length > 0) && (
                <div>
                  <p className="mb-2 flex items-center gap-1 text-xs font-bold uppercase tracking-[0.4px] text-ink-text-faint">
                    Hops
                    <HopCompartmentInfo />
                  </p>
                  <EditableRowList
                    rows={hops}
                    templateColumns="1.3fr 0.8fr 0.6fr 1fr"
                    columns={[
                      { key: 'name', label: 'Hop Type', type: 'text' },
                      { key: 'amount', label: `Amount (${weightUnit})`, type: 'number', step: 0.1 },
                      { key: 'aa', label: 'AA%', type: 'number', step: 0.1 },
                      { key: 'compartment', label: 'Compartment', type: 'select', options: HOP_COMPARTMENTS },
                    ]}
                    maxRows={HOP_COMPARTMENTS.length}
                    onChange={hopActions.onChange}
                    onAdd={() =>
                      hopActions.onAdd({
                        amount: ozToDisplay(0.5, weightUnit),
                        aa: 5,
                        compartment: nextFreeCompartment(hops),
                      })
                    }
                    onRemove={hopActions.onRemove}
                    addLabel="Add Hop"
                    readOnly={readOnly}
                  />
                </div>
              )}
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.4px] text-ink-text-faint">Yeast</p>
                <div className="grid gap-2" style={{ gridTemplateColumns: '1.6fr 0.9fr' }}>
                  <div>
                    <p className="mb-1 text-[10px] text-ink-text-faintest">Type</p>
                    {readOnly ? (
                      <p className="px-2.5 py-2 text-sm text-ink-text-muted">{yeastName || '—'}</p>
                    ) : (
                      <Input
                        value={yeastName}
                        onChange={(e) => setYeastName(e.target.value)}
                        placeholder="Included dry yeast packet"
                        className={cn('text-[13px]', dirtyClass(yeastName, recipe?.yeastName ?? '', isEditingExisting))}
                      />
                    )}
                  </div>
                  <div>
                    {/* Grams, not the oz/g Settings toggle — a yeast packet's weight is a fixed, tiny
                        number (almost always 2g/1 packet) that nobody needs in ounces. */}
                    <p className="mb-1 text-[10px] text-ink-text-faintest">Amount (g)</p>
                    {readOnly ? (
                      <p className="px-2.5 py-2 font-mono text-sm text-ink-text-muted">{yeastAmount}</p>
                    ) : (
                      <Input
                        type="number"
                        step={0.5}
                        value={yeastAmount}
                        onChange={(e) => setYeastAmount(Number(e.target.value))}
                        className={cn(
                          'font-mono text-[13px]',
                          dirtyClass(yeastAmount, recipe?.yeastAmount ?? 2, isEditingExisting),
                        )}
                      />
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}

          <Card className="gap-3.5 p-[22px]">
            <div>
              <button
                type="button"
                onClick={() => setStepsExpanded((v) => !v)}
                className="flex items-center gap-2 text-left"
              >
                <MdExpandMore
                  className={cn(
                    'size-[18px] text-ink-text-faint transition-transform duration-150',
                    stepsExpanded ? 'rotate-0' : '-rotate-90',
                  )}
                />
                <p className="text-[15px] font-bold">Steps</p>
              </button>
              <p className="mt-1 pl-[26px] text-[12px] text-ink-text-faint">
                PicoPacks are defined entirely by their step sequence — no separate mash/boil/fermentation science.
              </p>
            </div>
            <StepRangeWarnings warnings={stepWarnings} />
            {stepsExpanded && (
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
                Edit Steps
              </button>
            )}
          </Card>
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
