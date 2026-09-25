import { IngredientSection, RecipePackType } from '~/types';

// Plain-text descriptions of a recipe and a batch's sessions for the AI Brewmaster's prompts (session advice, the
// session chat and the recipe chat all share these), so the model works from the actual recipe and session facts
// instead of guessing.

type IngredientRow = {
  section: string;
  name: string;
  amount: number | null;
  unit: string | null;
  aa: number | null;
  time: number | null;
  temp: number | null;
  days: number | null;
  hours: number | null;
};

export type RecipeForAi = {
  name: string;
  style: string | null;
  packType: string;
  deviceType: string;
  abv: number;
  ibu: number;
  og: number | null;
  fg: number | null;
  colorSRM: number | null;
  batchSize: number | null;
  fermentDays: number | null;
  mashType: number | null;
  boilTime: number | null;
  boilTemp: number | null;
  fermentationType: number | null;
  yeastName: string | null;
  yeastAmount: number | null;
  yeastAttenuation: number | null;
  yeastRangeTemp: string | null;
  yeastPitchTemp: number | null;
  notes: string | null;
  ingredients: IngredientRow[];
};

const MASH_TYPES = ['single step', 'high-efficiency multi step', 'custom', 'single step with mash out'];
const FERMENTATION_TYPES = ['ale', 'lager', 'advanced/custom'];
const MAX_ROWS = 12;

const round = (n: number) => Math.round(n * 100) / 100;

function rows(list: IngredientRow[], format: (row: IngredientRow) => string): string {
  const shown = list.slice(0, MAX_ROWS).map(format);
  return list.length > MAX_ROWS ? `${shown.join('; ')}; +${list.length - MAX_ROWS} more` : shown.join('; ');
}

// Amounts are stored canonically: hops and PicoPak grain in ounces, ZPack fermentables in pounds; other sections
// carry their own unit.
function amountText(row: IngredientRow, defaultUnit: string, useRowUnit = true): string {
  return row.amount == null ? '' : ` ${round(row.amount)} ${(useRowUnit && row.unit) || defaultUnit}`.trimEnd();
}

// PicoPack hops keep the pak compartment they drop from ("Adjunct1"...) in `unit`, not a measurement unit.
const compartmentText = (row: IngredientRow) => (row.unit && /^Adjunct\d$/.test(row.unit) ? ` from ${row.unit}` : '');

// -1 is this app's "not set" sentinel for ABV/IBU (see app/utils/brew-stats.ts).
export function describeRecipeForAi(recipe: RecipeForAi): string {
  const lines: string[] = [];
  const isZPack = recipe.packType === RecipePackType.ZPACK;
  const kind = isZPack ? 'ZPack (full brew-science recipe)' : 'PicoPack (machine steps only)';
  lines.push(
    `Recipe "${recipe.name}"${recipe.style ? ` (${recipe.style})` : ''} — ${kind}, ${recipe.deviceType} device.`,
  );

  const targets = [
    recipe.og != null ? `OG ${recipe.og}` : null,
    recipe.fg != null ? `FG ${recipe.fg}` : null,
    recipe.abv >= 0 ? `ABV ${recipe.abv}%` : null,
    recipe.ibu >= 0 ? `IBU ${recipe.ibu}` : null,
    recipe.colorSRM != null ? `SRM ${recipe.colorSRM}` : null,
    recipe.batchSize != null ? `batch ${round(recipe.batchSize * 3.78541)} L (${round(recipe.batchSize)} gal)` : null,
  ].filter(Boolean);
  if (targets.length) {
    lines.push(`Targets: ${targets.join(', ')}.`);
  }

  const brewDay = [
    recipe.mashType != null ? `mash: ${MASH_TYPES[recipe.mashType] ?? recipe.mashType}` : null,
    recipe.boilTime != null ? `boil ${recipe.boilTime} min` : null,
    recipe.boilTemp != null ? `boil temp ${recipe.boilTemp}°F` : null,
  ].filter(Boolean);
  if (brewDay.length) {
    lines.push(`Brew day: ${brewDay.join(', ')}.`);
  }

  const yeast = [
    recipe.yeastName,
    recipe.yeastAmount != null ? `${recipe.yeastAmount} g` : null,
    recipe.yeastAttenuation != null ? `${recipe.yeastAttenuation}% attenuation` : null,
    recipe.yeastPitchTemp != null ? `pitch at ${recipe.yeastPitchTemp}°F` : null,
    recipe.yeastRangeTemp ? `ferments ${recipe.yeastRangeTemp}` : null,
  ].filter(Boolean);
  const fermentation = [
    recipe.fermentationType != null ? FERMENTATION_TYPES[recipe.fermentationType] ?? null : null,
    recipe.fermentDays ? `expected ${recipe.fermentDays} days` : null,
  ].filter(Boolean);
  if (yeast.length || fermentation.length) {
    lines.push(
      `Fermentation: ${[yeast.length ? `yeast ${yeast.join(', ')}` : null, ...fermentation]
        .filter(Boolean)
        .join('; ')}.`,
    );
  }

  const bySection = (section: IngredientSection) => recipe.ingredients.filter((i) => i.section === section);
  const grain = bySection(IngredientSection.FERMENTABLE);
  if (grain.length) {
    lines.push(`Grain bill: ${rows(grain, (r) => `${r.name}${amountText(r, isZPack ? 'lb' : 'oz', false)}`)}.`);
  }
  const hops = bySection(IngredientSection.BOIL_HOP);
  if (hops.length) {
    lines.push(
      `Boil hops: ${rows(
        hops,
        (r) =>
          `${r.name}${amountText(r, 'oz', false)}${compartmentText(r)}${r.aa != null ? ` ${r.aa}% AA` : ''}${
            r.time != null ? ` at ${r.time} min` : ''
          }`,
      )}.`,
    );
  }
  const dryHops = bySection(IngredientSection.DRY_HOP);
  if (dryHops.length) {
    lines.push(
      `Dry hops: ${rows(
        dryHops,
        (r) => `${r.name}${amountText(r, 'oz', false)}${compartmentText(r)}${r.time != null ? ` (${r.time})` : ''}`,
      )}.`,
    );
  }
  const other = [...bySection(IngredientSection.OTHER_BOIL), ...bySection(IngredientSection.WATER)];
  if (other.length) {
    lines.push(`Other additions: ${rows(other, (r) => `${r.name}${amountText(r, '')}`.trim())}.`);
  }
  const mash = bySection(IngredientSection.MASH_STEP);
  if (mash.length) {
    lines.push(`Mash schedule: ${rows(mash, (r) => `${r.name} ${r.temp ?? '?'}°F for ${r.time ?? '?'} min`)}.`);
  }
  const ferment = bySection(IngredientSection.FERMENTATION_STEP);
  if (ferment.length) {
    lines.push(
      `Fermentation schedule: ${rows(
        ferment,
        (r) => `${r.name} ${r.temp ?? '?'}°F for ${r.days ?? 0}d ${r.hours ?? 0}h`,
      )}.`,
    );
  }
  if (recipe.notes?.trim()) {
    lines.push(`Recipe notes: ${recipe.notes.trim().slice(0, 500)}`);
  }
  return lines.join('\n');
}

const SESSION_TYPE_LABELS: Record<number, string> = {
  0: 'Brewing',
  1: 'Deep clean',
  2: 'Sous vide',
  3: 'Fermentation',
  4: 'Cold brew',
  5: 'Manual brew',
};

type SessionForAi = {
  type: number;
  state: number;
  statusText: string;
  createdAt: Date;
  device: { name: string; deviceType: string; color: string | null } | null;
};

const SESSION_STATES = ['ready', 'in progress', 'completed', 'canceled'];

function ago(from: Date): string {
  const hours = (Date.now() - new Date(from).getTime()) / 3600000;
  return hours < 48 ? `${Math.round(hours)}h ago` : `${(hours / 24).toFixed(1)} days ago`;
}

// One line per session (the machine, its state and when it started) so the model knows which device it is talking
// about and how far along each leg is.
export function describeSessionsForAi(sessions: SessionForAi[]): string {
  return sessions
    .map((s) => {
      const device = s.device
        ? `${s.device.name} (${s.device.deviceType}${s.device.color ? `, ${s.device.color}` : ''})`
        : 'unknown device';
      const state = SESSION_STATES[s.state] ?? String(s.state);
      return `${SESSION_TYPE_LABELS[s.type] ?? `Session type ${s.type}`} session on ${device}: ${state}${
        s.statusText ? ` ("${s.statusText}")` : ''
      }, started ${ago(s.createdAt)}.`;
    })
    .join('\n');
}
