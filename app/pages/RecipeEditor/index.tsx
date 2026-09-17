import { Box, Button, Checkbox, Flex, Grid, Icon, Input, Select, Text, Textarea } from '@chakra-ui/react';
import { Form, Link, useNavigate, useNavigation } from '@remix-run/react';
import { useMemo, useRef, useState, type FC } from 'react';
import { MdArrowBack, MdCameraAlt, MdEdit, MdError, MdExpandMore } from 'react-icons/md';
import Card from '~/components/card/Card';
import { EditableRowList } from '~/components/recipe-editor/EditableRowList';
import { MachineStepsModal, type MachineStepRow } from '~/components/recipe-editor/MachineStepsModal';
import { IngredientSection, PicoLocationMap } from '~/types';
import { validatePicoRecipe } from '~/utils/pico-recipe-validation';

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
  { id: newId(), name: 'Heating', location: PicoLocationMap.Mash, temperature: 156, stepTime: 15, drainTime: 0 },
  { id: newId(), name: 'Dough In', location: PicoLocationMap.Mash, temperature: 152, stepTime: 20, drainTime: 0 },
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

const FieldLabel: FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text fontSize="11px" fontWeight="600" color="ink.textSecondary" mb="5px">
    {children}
  </Text>
);

const FieldValue: FC<{ children: React.ReactNode; mono?: boolean }> = ({ children, mono }) => (
  <Text px="11px" py="9px" fontSize="14px" fontFamily={mono ? 'mono' : undefined} color="ink.textMuted">
    {children}
  </Text>
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

const OverviewStat: FC<{
  label: string;
  value: React.ReactNode;
  min?: string;
  max?: string;
  input?: React.ReactNode;
}> = ({ label, value, min, max, input }) => (
  <Box>
    <Text fontSize="11px" fontWeight="700" color="ink.textFaint" textTransform="uppercase">
      {label}
    </Text>
    {input ?? (
      <Text mt="4px" px="8px" py="6px" fontSize="14px" fontWeight="700" fontFamily="mono">
        {value}
      </Text>
    )}
    {(min || max) && (
      <Text fontSize="10px" color="ink.textFaintest" mt="4px">
        MIN {min ?? '—'} · MAX {max ?? '—'}
      </Text>
    )}
  </Box>
);

const rowsToIngredients = (
  rows: Row[],
  section: IngredientSection,
  fields: Array<keyof Row>,
): RecipeEditorIngredient[] =>
  rows
    .filter((r) => r.name.trim() !== '')
    .map((r) => ({
      section,
      name: r.name,
      amount: fields.includes('amount') ? r.amount ?? null : null,
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

  const bySection = (section: IngredientSection): Row[] =>
    (recipe?.ingredients ?? [])
      .filter((i) => i.section === section)
      .map((i) => ({
        id: newId(),
        name: i.name,
        amount: i.amount ?? undefined,
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
  const fg = recipe?.fg ?? null;
  const srm = recipe?.colorSRM ?? null;
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
      abv,
      ibu,
      style,
      og,
      fg: fg ?? undefined,
      colorSRM: srm ?? undefined,
      notes,
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
        ...rowsToIngredients(amendments, IngredientSection.WATER, ['amount', 'unit']),
        ...rowsToIngredients(mashSteps, IngredientSection.MASH_STEP, ['temp', 'time']),
        ...rowsToIngredients(fermentables, IngredientSection.FERMENTABLE, ['amount', 'color']),
        ...rowsToIngredients(hops, IngredientSection.BOIL_HOP, ['amount', 'aa', 'time']),
        ...rowsToIngredients(otherBoil, IngredientSection.OTHER_BOIL, ['amount', 'unit', 'time']),
        ...rowsToIngredients(fermentationSteps, IngredientSection.FERMENTATION_STEP, ['temp', 'days', 'hours']),
        ...rowsToIngredients(dryHops, IngredientSection.DRY_HOP, ['amount', 'aa', 'time']),
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
      recipe,
      notes,
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
    ],
  );

  const FormWrapper = readOnly ? Box : Form;
  const formWrapperProps = readOnly ? {} : { method: 'post' as const, encType: 'multipart/form-data' as const };

  return (
    <>
      <Flex align="center" gap="12px" mb="4px">
        <Box
          as="button"
          type="button"
          onClick={() => navigate('/recipes')}
          display="flex"
          alignItems="center"
          justifyContent="center"
          w="32px"
          h="32px"
          borderRadius="7px"
          bg="ink.card"
          border="1px solid"
          borderColor="ink.cardBorder"
        >
          <Icon as={MdArrowBack} boxSize="15px" />
        </Box>
        <Box flex="1" minW="0">
          <Text fontSize="19px" fontWeight="700" noOfLines={1}>
            {name || 'New Recipe'}
          </Text>
          <Text fontSize="12px" color="ink.textFaint">
            {style || ' '}
          </Text>
        </Box>
        {readOnly && recipe && (
          <Link to={`/recipes/${recipe.id}`}>
            <Button variant="brand" size="sm" leftIcon={<Icon as={MdEdit} />}>
              Edit Recipe
            </Button>
          </Link>
        )}
      </Flex>

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

        <Box display="flex" flexDirection="column" gap="16px" maxW="1040px">
          {blockingErrors && !readOnly && (
            <Box
              bg="danger.100"
              border="1px solid"
              borderColor="danger.500"
              borderRadius="10px"
              p="14px 16px"
              display="flex"
              flexDirection="column"
              gap="6px"
            >
              <Flex align="center" gap="8px" fontSize="13px" fontWeight="700" color="danger.500">
                <Icon as={MdError} boxSize="15px" />
                Fix these before saving
              </Flex>
              {errors.map((err) => (
                <Text key={err} fontSize="13px" color="ink.textSecondary" pl="23px">
                  {err}
                </Text>
              ))}
            </Box>
          )}

          {!readOnly && (
            <Flex justify="flex-end">
              <Button type="submit" variant="brand" isDisabled={blockingErrors} isLoading={isSubmitting}>
                Save Recipe
              </Button>
            </Flex>
          )}

          {/* Overview */}
          <Card p="22px" gap="22px" flexDirection={{ base: 'column', md: 'row' }}>
            <Box
              as="button"
              type="button"
              disabled={readOnly}
              onClick={readOnly ? undefined : () => fileInputRef.current?.click()}
              w="180px"
              h="220px"
              flex="0 0 auto"
              borderRadius="12px"
              border="1px dashed"
              borderColor="ink.borderStrong"
              bg="ink.bg"
              backgroundImage={`url(${photoPreview || '/img/no-photo.jpg'})`}
              backgroundSize="cover"
              backgroundPosition="center"
              display="flex"
              alignItems="center"
              justifyContent="center"
              overflow="hidden"
              cursor={readOnly ? 'default' : 'pointer'}
            >
              {!photoPreview && !readOnly && (
                <Flex
                  direction="column"
                  align="center"
                  gap="6px"
                  color="ink.text"
                  bg="blackAlpha.600"
                  px="10px"
                  py="8px"
                  borderRadius="8px"
                >
                  <Icon as={MdCameraAlt} boxSize="24px" />
                  <Text fontSize="12px">Beer glass photo</Text>
                </Flex>
              )}
            </Box>
            <Box flex="1" minW="260px" display="flex" flexDirection="column" gap="14px">
              <Box>
                <Text fontSize="20px" fontWeight="700">
                  {name || 'New Recipe'}
                </Text>
                <Text fontSize="13px" color="ink.textDim" mt="2px">
                  {style || ' '}
                </Text>
              </Box>
              <Grid templateColumns="repeat(auto-fit, minmax(90px, 1fr))" gap="12px">
                <OverviewStat
                  label="OG"
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
                        mt="4px"
                        h="30px"
                        fontFamily="mono"
                        fontWeight="700"
                        bg="ink.bg"
                        borderColor="ink.cardBorder"
                      />
                    )
                  }
                />
                <OverviewStat
                  label="FG"
                  value={fg != null ? fg.toFixed(3) : '—'}
                  min={recipe?.fgMin?.toFixed(3)}
                  max={recipe?.fgMax?.toFixed(3)}
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
                        mt="4px"
                        h="30px"
                        fontFamily="mono"
                        fontWeight="700"
                        bg="ink.bg"
                        borderColor="ink.cardBorder"
                      />
                    )
                  }
                />
                <OverviewStat
                  label="SRM"
                  value={srm ?? '—'}
                  min={recipe?.srmMin?.toString()}
                  max={recipe?.srmMax?.toString()}
                />
                <OverviewStat
                  label="ABV %"
                  value={abv.toFixed(1)}
                  min={recipe?.abvMin?.toString()}
                  max={recipe?.abvMax?.toString()}
                />
              </Grid>
            </Box>
          </Card>

          {/* Composition */}
          <Card p="22px" gap="16px">
            <Text fontSize="15px" fontWeight="700">
              Composition
            </Text>
            <Grid templateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="20px">
              <Flex direction="column" align="center" gap="12px">
                <Text
                  fontSize="12px"
                  fontWeight="700"
                  color="ink.textFaint"
                  textTransform="uppercase"
                  letterSpacing="0.4px"
                >
                  Grain Bill
                </Text>
                <Box w="120px" h="120px" borderRadius="full" bg={grain.background} position="relative">
                  <Box position="absolute" inset="16px" borderRadius="full" bg="ink.card" />
                </Box>
                <Flex direction="column" gap="4px">
                  {grain.legend.map((item) => (
                    <Flex key={item.label} align="center" gap="6px" fontSize="12px" color="ink.textSecondary">
                      <Box w="9px" h="9px" borderRadius="full" bg={item.color} />
                      {item.label}
                    </Flex>
                  ))}
                </Flex>
              </Flex>
              <Flex direction="column" align="center" gap="12px">
                <Text
                  fontSize="12px"
                  fontWeight="700"
                  color="ink.textFaint"
                  textTransform="uppercase"
                  letterSpacing="0.4px"
                >
                  Hop Bill
                </Text>
                <Box w="120px" h="120px" borderRadius="full" bg={hopDonut.background} position="relative">
                  <Box position="absolute" inset="16px" borderRadius="full" bg="ink.card" />
                </Box>
                <Flex direction="column" gap="4px">
                  {hopDonut.legend.map((item) => (
                    <Flex key={item.label} align="center" gap="6px" fontSize="12px" color="ink.textSecondary">
                      <Box w="9px" h="9px" borderRadius="full" bg={item.color} />
                      {item.label}
                    </Flex>
                  ))}
                </Flex>
              </Flex>
              <Flex direction="column" align="center" gap="12px">
                <Text
                  fontSize="12px"
                  fontWeight="700"
                  color="ink.textFaint"
                  textTransform="uppercase"
                  letterSpacing="0.4px"
                >
                  Wort Curve
                </Text>
                <Box as="svg" width="100%" height="120px" viewBox="0 0 260 120" preserveAspectRatio="none">
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
                </Box>
                <Text fontSize="12px" color="ink.textSecondary" textAlign="center">
                  Brew Time (Est.):{' '}
                  <Text as="b" color="ink.text">
                    {wort.brewTimeLabel}
                  </Text>
                  <br />
                  Chill Time (Est.):{' '}
                  <Text as="b" color="ink.text">
                    {wort.chillTimeLabel}
                  </Text>
                </Text>
              </Flex>
            </Grid>
          </Card>

          {/* Recipe Details */}
          <Card p="22px" gap="14px">
            <Text fontSize="15px" fontWeight="700">
              Recipe Details
            </Text>
            <Flex gap="14px" wrap="wrap">
              <Box flex="1" minW="200px">
                <FieldLabel>Recipe Name *</FieldLabel>
                {readOnly ? (
                  <FieldValue>{name}</FieldValue>
                ) : (
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                )}
              </Box>
              <Box flex="1" minW="200px">
                <FieldLabel>Style</FieldLabel>
                {readOnly ? (
                  <FieldValue>{style || '—'}</FieldValue>
                ) : (
                  <Input value={style} onChange={(e) => setStyle(e.target.value)} />
                )}
              </Box>
            </Flex>
            <Box>
              <FieldLabel>Notes</FieldLabel>
              {readOnly ? (
                <FieldValue>{notes || '—'}</FieldValue>
              ) : (
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} resize="vertical" />
              )}
            </Box>
          </Card>

          {/* Water */}
          <Card p="22px" gap="14px">
            <Text fontSize="15px" fontWeight="700">
              Water
            </Text>
            <Flex gap="14px" wrap="wrap">
              <Box flex="1" minW="160px">
                <FieldLabel>Batch Size (Gal)</FieldLabel>
                {readOnly ? (
                  <FieldValue mono>{batchSize}</FieldValue>
                ) : (
                  <Input
                    type="number"
                    step={0.1}
                    value={batchSize}
                    onChange={(e) => setBatchSize(Number(e.target.value))}
                    fontFamily="mono"
                  />
                )}
              </Box>
              <Box flex="1" minW="160px">
                <FieldLabel>Starting Water (Gal)</FieldLabel>
                <Text px="11px" py="9px" fontSize="13px" fontFamily="mono" color="ink.textMuted">
                  {startingWater}
                </Text>
              </Box>
            </Flex>
            {(!readOnly || amendments.length > 0) && (
              <Box>
                <Text
                  fontSize="12px"
                  fontWeight="700"
                  color="ink.textFaint"
                  textTransform="uppercase"
                  letterSpacing="0.4px"
                  mb="8px"
                >
                  Water Amendments
                </Text>
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
              </Box>
            )}
          </Card>

          {/* Mash & Fermentables */}
          <Card p="22px" gap="16px">
            <Text fontSize="15px" fontWeight="700">
              Mash &amp; Fermentables
            </Text>
            <Box maxW="220px">
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
            </Box>
            {(!readOnly || mashSteps.length > 0) && (
              <Box>
                <Text
                  fontSize="12px"
                  fontWeight="700"
                  color="ink.textFaint"
                  textTransform="uppercase"
                  letterSpacing="0.4px"
                  mb="8px"
                >
                  Mash Steps
                </Text>
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
              </Box>
            )}
            {(!readOnly || fermentables.length > 0) && (
              <Box>
                <Text
                  fontSize="12px"
                  fontWeight="700"
                  color="ink.textFaint"
                  textTransform="uppercase"
                  letterSpacing="0.4px"
                  mb="8px"
                >
                  Fermentables
                </Text>
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
              </Box>
            )}
          </Card>

          {/* Boil */}
          <Card p="22px" gap="16px">
            <Text fontSize="15px" fontWeight="700">
              Boil
            </Text>
            <Flex gap="14px" wrap="wrap">
              <Box flex="1" minW="160px">
                <FieldLabel>Total Boil Time (min)</FieldLabel>
                {readOnly ? (
                  <FieldValue mono>{boilTime}</FieldValue>
                ) : (
                  <Input
                    type="number"
                    value={boilTime}
                    onChange={(e) => setBoilTime(Number(e.target.value))}
                    fontFamily="mono"
                  />
                )}
              </Box>
              <Box flex="1" minW="160px">
                <FieldLabel>Boil Temp °F</FieldLabel>
                {readOnly ? (
                  <FieldValue mono>{boilTemp}</FieldValue>
                ) : (
                  <Input
                    type="number"
                    value={boilTemp}
                    onChange={(e) => setBoilTemp(Number(e.target.value))}
                    fontFamily="mono"
                  />
                )}
              </Box>
              <Box flex="1" minW="180px">
                <FieldLabel>First Wort Hopping</FieldLabel>
                {readOnly ? (
                  <FieldValue>{firstWortHopping ? 'Enabled' : 'Disabled'}</FieldValue>
                ) : (
                  <Checkbox
                    isChecked={firstWortHopping}
                    onChange={(e) => setFirstWortHopping(e.target.checked)}
                    colorScheme="brand"
                    mt="6px"
                  >
                    <Text fontSize="13px" color="ink.textSecondary">
                      Enabled
                    </Text>
                  </Checkbox>
                )}
              </Box>
            </Flex>
            {(!readOnly || hops.length > 0) && (
              <Box>
                <Text
                  fontSize="12px"
                  fontWeight="700"
                  color="ink.textFaint"
                  textTransform="uppercase"
                  letterSpacing="0.4px"
                  mb="8px"
                >
                  Hops
                </Text>
                <EditableRowList
                  rows={hops}
                  templateColumns="1.4fr 0.8fr 0.7fr 0.8fr"
                  columns={[
                    { key: 'name', label: 'Type', type: 'text' },
                    { key: 'amount', label: 'Amount (oz)', type: 'number', step: 0.1 },
                    { key: 'aa', label: 'AA%', type: 'number', step: 0.1 },
                    { key: 'time', label: 'Time (min)', type: 'number' },
                  ]}
                  onChange={hopActions.onChange}
                  onAdd={() => hopActions.onAdd({ amount: 1, aa: 5, time: 15 })}
                  onRemove={hopActions.onRemove}
                  addLabel="Add Hop"
                  readOnly={readOnly}
                />
              </Box>
            )}
            {(!readOnly || otherBoil.length > 0) && (
              <Box>
                <Text
                  fontSize="12px"
                  fontWeight="700"
                  color="ink.textFaint"
                  textTransform="uppercase"
                  letterSpacing="0.4px"
                  mb="8px"
                >
                  Other Boil Ingredients
                </Text>
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
              </Box>
            )}
          </Card>

          {/* Fermentation */}
          <Card p="22px" gap="16px">
            <Text fontSize="15px" fontWeight="700">
              Fermentation
            </Text>
            <Box maxW="220px">
              <FieldLabel>Fermentation Type</FieldLabel>
              {readOnly ? (
                <FieldValue>{FERMENTATION_TYPE_LABELS[fermentationType] ?? fermentationType}</FieldValue>
              ) : (
                <Select value={fermentationType} onChange={(e) => setFermentationType(e.target.value)}>
                  <option value="0">Ale</option>
                  <option value="1">Lager</option>
                  <option value="2">Advanced / Custom</option>
                </Select>
              )}
            </Box>
            <Box>
              <Text
                fontSize="12px"
                fontWeight="700"
                color="ink.textFaint"
                textTransform="uppercase"
                letterSpacing="0.4px"
                mb="8px"
              >
                Yeast
              </Text>
              <Grid templateColumns="1.6fr 0.9fr 0.9fr 0.9fr" gap="8px">
                <Box>
                  <Text fontSize="10px" color="ink.textFaintest" mb="4px">
                    Name
                  </Text>
                  {readOnly ? (
                    <FieldValue>{yeastName || '—'}</FieldValue>
                  ) : (
                    <Input value={yeastName} onChange={(e) => setYeastName(e.target.value)} fontSize="13px" />
                  )}
                </Box>
                <Box>
                  <Text fontSize="10px" color="ink.textFaintest" mb="4px">
                    Expected Attenuation %
                  </Text>
                  {readOnly ? (
                    <FieldValue mono>{yeastAttenuation}</FieldValue>
                  ) : (
                    <Input
                      type="number"
                      value={yeastAttenuation}
                      onChange={(e) => setYeastAttenuation(Number(e.target.value))}
                      fontFamily="mono"
                      fontSize="13px"
                    />
                  )}
                </Box>
                <Box>
                  <Text fontSize="10px" color="ink.textFaintest" mb="4px">
                    Range Temp °F
                  </Text>
                  {readOnly ? (
                    <FieldValue mono>{yeastRangeTemp || '—'}</FieldValue>
                  ) : (
                    <Input
                      value={yeastRangeTemp}
                      onChange={(e) => setYeastRangeTemp(e.target.value)}
                      fontFamily="mono"
                      fontSize="13px"
                      placeholder="64 - 82"
                    />
                  )}
                </Box>
                <Box>
                  <Text fontSize="10px" color="ink.textFaintest" mb="4px">
                    Pitch Temp °F
                  </Text>
                  {readOnly ? (
                    <FieldValue mono>{yeastPitchTemp}</FieldValue>
                  ) : (
                    <Input
                      type="number"
                      value={yeastPitchTemp}
                      onChange={(e) => setYeastPitchTemp(Number(e.target.value))}
                      fontFamily="mono"
                      fontSize="13px"
                    />
                  )}
                </Box>
              </Grid>
            </Box>
            {(!readOnly || fermentationSteps.length > 0) && (
              <Box>
                <Text
                  fontSize="12px"
                  fontWeight="700"
                  color="ink.textFaint"
                  textTransform="uppercase"
                  letterSpacing="0.4px"
                  mb="8px"
                >
                  Fermentation Steps
                </Text>
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
              </Box>
            )}
            {(!readOnly || dryHops.length > 0) && (
              <Box>
                <Text
                  fontSize="12px"
                  fontWeight="700"
                  color="ink.textFaint"
                  textTransform="uppercase"
                  letterSpacing="0.4px"
                  mb="8px"
                >
                  Dry Hops
                </Text>
                <EditableRowList
                  rows={dryHops}
                  templateColumns="1.4fr 0.8fr 0.7fr 0.8fr"
                  columns={[
                    { key: 'name', label: 'Type', type: 'text' },
                    { key: 'amount', label: 'Amount (oz)', type: 'number', step: 0.1 },
                    { key: 'aa', label: 'AA%', type: 'number', step: 0.1 },
                    { key: 'time', label: 'Time (days)', type: 'number' },
                  ]}
                  onChange={dryHopActions.onChange}
                  onAdd={() => dryHopActions.onAdd({ amount: 1, aa: 5, time: 3 })}
                  onRemove={dryHopActions.onRemove}
                  addLabel="Add Hop"
                  readOnly={readOnly}
                />
              </Box>
            )}
          </Card>

          {/* Machine Steps */}
          <Card p="22px" gap="14px">
            <Flex
              align="center"
              gap="8px"
              as="button"
              type="button"
              onClick={() => setMachineStepsExpanded((v) => !v)}
              cursor="pointer"
              textAlign="left"
            >
              <Icon
                as={MdExpandMore}
                boxSize="18px"
                color="ink.textFaint"
                transform={machineStepsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)'}
                transition="transform 0.15s ease"
              />
              <Text fontSize="15px" fontWeight="700">
                Machine Steps
              </Text>
            </Flex>
            {machineStepsExpanded && (
              <Box border="1px solid" borderColor="ink.divider" borderRadius="10px" overflow="hidden">
                <Grid
                  templateColumns="1.7fr 1fr 0.8fr 0.8fr 0.8fr"
                  gap="10px"
                  px="14px"
                  py="10px"
                  bg="ink.bg"
                  fontSize="11px"
                  fontWeight="700"
                  letterSpacing="0.4px"
                  color="ink.textFaint"
                  textTransform="uppercase"
                >
                  <Text>Name</Text>
                  <Text>Location</Text>
                  <Text>Temp °F</Text>
                  <Text>Time (min)</Text>
                  <Text>Drain (min)</Text>
                </Grid>
                {machineSteps.map((row, index) => (
                  <Grid
                    key={row.id}
                    templateColumns="1.7fr 1fr 0.8fr 0.8fr 0.8fr"
                    gap="10px"
                    px="14px"
                    py="9px"
                    alignItems="center"
                    borderTop={index > 0 ? '1px solid' : undefined}
                    borderColor="ink.divider"
                    fontSize="13px"
                  >
                    <Text>{row.name}</Text>
                    <Text color="ink.textMuted">{PicoLocationMap[row.location]}</Text>
                    <Text fontFamily="mono">{row.temperature}</Text>
                    <Text fontFamily="mono">{row.stepTime}</Text>
                    <Text fontFamily="mono">{row.drainTime}</Text>
                  </Grid>
                ))}
              </Box>
            )}
            {!readOnly && (
              <Text
                as="button"
                type="button"
                onClick={() => setModalOpen(true)}
                alignSelf="flex-start"
                fontSize="13px"
                fontWeight="600"
                color="brand.500"
                cursor="pointer"
              >
                Edit Machine Steps
              </Text>
            )}
          </Card>
          <Text fontSize="11px" color="ink.textFaintest" px="4px">
            Firmware program run by the Pico. Step times are subject to change when compensating for lower boil temp.
          </Text>
        </Box>
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

export default RecipeEditor;
