import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { data } from 'react-router';
import { IngredientSection, RecipeRepository, type CreateRecipeInput } from '~/repositories/recipe.server';
import { DeviceType, PicoLocationMap, RecipePackType } from '~/types';
import { requireUser, requireWriter } from '~/services/auth.server';

// Two local data snapshots — both re-synced via the scripts noted below, not fetched live:
//  - ZPak/Community: github.com/Justin-Credible/picobrew-recipes (unlicensed/open source; see
//    PLAN.md). Re-sync: the download commands in PLAN.md's "Import from PicoBrew DB" entry.
//  - PicoPak: the user's own PicoBrew vendor-API pull (sibling picopak-library repo). Re-sync:
//    scripts/sync-picopak-library.py.
const ZPAK_DATA_DIR = path.join(process.cwd(), 'data', 'picobrew-recipes');
const PICOPAK_DATA_DIR = path.join(process.cwd(), 'data', 'picopak-library');
const GUID_PATTERN = /^[a-f0-9]{32}$/i;
const PICOPAK_ID_PATTERN = /^\d+$/;
const PAGE_SIZE = 24;

type Tab = 'zpak' | 'community' | 'picopak';

type ZPakListEntry = {
  Name: string;
  Author: string;
  Style: string;
  OG: number;
  FG: number;
  IBU: number;
  ABV: number;
  SRM: number;
  GUID: string;
  Grains: string;
  Hops: string;
};

type PicoPakIndexEntry = { id: number; name: string; abv: number | null; ibu: number | null };

// The shape every tab's items are normalized to for the picker UI — PicoPak entries just leave
// the brew-science-only fields null, since that format never had them to begin with.
type ResultItem = {
  id: string;
  name: string;
  style: string | null;
  author: string | null;
  abv: number;
  ibu: number;
  og: number | null;
  fg: number | null;
  srm: number | null;
};

// Module-level caches: all three sources are static for the process lifetime, so each is read
// from disk once instead of on every request.
let zpakListCache: ZPakListEntry[] | null = null;
let communityListCache: ZPakListEntry[] | null = null;
let communityOnlyCache: ZPakListEntry[] | null = null;
let picopakIndexCache: PicoPakIndexEntry[] | null = null;

async function loadZPakList(): Promise<ZPakListEntry[]> {
  if (!zpakListCache) {
    const raw = await fs.readFile(path.join(ZPAK_DATA_DIR, 'recipe-list-official.json'), 'utf-8');
    zpakListCache = (JSON.parse(raw) as { PublicRecipesList: ZPakListEntry[] }).PublicRecipesList;
  }
  return zpakListCache;
}

async function loadFullCommunityList(): Promise<ZPakListEntry[]> {
  if (!communityListCache) {
    const raw = await fs.readFile(path.join(ZPAK_DATA_DIR, 'recipe-list-community.json'), 'utf-8');
    communityListCache = (JSON.parse(raw) as { PublicRecipesList: ZPakListEntry[] }).PublicRecipesList;
  }
  return communityListCache;
}

// "Community" means community-submitted, not "official + community" — the official list (ZPak
// tab) is a strict subset of this file, so it's excluded here to avoid showing the same 234
// recipes under both tabs.
async function loadCommunityOnlyList(): Promise<ZPakListEntry[]> {
  if (!communityOnlyCache) {
    const [official, community] = await Promise.all([loadZPakList(), loadFullCommunityList()]);
    const officialGuids = new Set(official.map((r) => r.GUID));
    communityOnlyCache = community.filter((r) => !officialGuids.has(r.GUID));
  }
  return communityOnlyCache;
}

// Anything with "test" in its name, plus keyboard-mashed placeholders, is filtered out at
// sync time — see scripts/sync-picopak-library.py's is_junk_name().
async function loadPicopakIndex(): Promise<PicoPakIndexEntry[]> {
  if (!picopakIndexCache) {
    const raw = await fs.readFile(path.join(PICOPAK_DATA_DIR, 'picopak-index.json'), 'utf-8');
    picopakIndexCache = JSON.parse(raw) as PicoPakIndexEntry[];
  }
  return picopakIndexCache;
}

type SortKey = 'name' | 'abv' | 'ibu';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireUser(request);
  const url = new URL(request.url);
  const tabParam = url.searchParams.get('tab');
  const tab: Tab = tabParam === 'community' || tabParam === 'picopak' ? tabParam : 'zpak';
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const sortParam = url.searchParams.get('sort');
  const sort: SortKey = (['name', 'abv', 'ibu'] as SortKey[]).includes(sortParam as SortKey)
    ? (sortParam as SortKey)
    : 'name';
  const dir = url.searchParams.get('dir') === 'desc' ? 'desc' : 'asc';

  let items: ResultItem[];
  if (tab === 'picopak') {
    const index = await loadPicopakIndex();
    items = index.map((r) => ({
      id: String(r.id),
      name: r.name,
      style: null,
      author: null,
      abv: r.abv ?? 0,
      ibu: r.ibu ?? 0,
      og: null,
      fg: null,
      srm: null,
    }));
  } else {
    const list = tab === 'community' ? await loadCommunityOnlyList() : await loadZPakList();
    items = list.map((r) => ({
      id: r.GUID,
      name: r.Name,
      style: r.Style || null,
      author: r.Author || null,
      abv: r.ABV,
      ibu: r.IBU,
      og: r.OG,
      fg: r.FG,
      srm: r.SRM,
    }));
  }

  const filtered = q
    ? items.filter((r) => [r.name, r.style, r.author].some((f) => (f ?? '').toLowerCase().includes(q)))
    : items;

  const sorted = [...filtered].sort((a, b) => {
    const cmp = sort === 'abv' ? a.abv - b.abv : sort === 'ibu' ? a.ibu - b.ibu : a.name.localeCompare(b.name);
    return dir === 'asc' ? cmp : -cmp;
  });

  const total = sorted.length;
  const start = (page - 1) * PAGE_SIZE;

  return { items: sorted.slice(start, start + PAGE_SIZE), total, page, pageSize: PAGE_SIZE, tab, q, sort, dir };
};

// The imported JSON's shape (PicoBrew's own "Recipe" export format, ZPak/Community tabs) — only
// the fields this mapper actually reads; everything else in the real files (whirlpool adjuncts,
// sync metadata, etc.) is intentionally left unmapped rather than guessed at.
type PicoBrewRecipe = {
  Name?: string;
  ABV?: number;
  IBU?: number;
  OG?: number;
  FG?: number;
  SRM?: number;
  Notes?: string;
  TastingNotes?: string;
  // Added to the local data snapshot by scripts/tag-picobrew-recipe-types.py — not part of
  // PicoBrew's original export format.
  Type?: string;
  BeerStyle?: { StyleNameCode?: string };
  BatchSize?: number;
  MashType?: number;
  BoilTime?: number;
  BoilTemp?: number;
  IsFirstWort?: boolean;
  FermentationType?: number;
  Yeast?: {
    Name?: string;
    Laboratory?: string;
    ExpectedAtten?: number;
    ExpectedTemp?: number;
    MinTemp?: number;
    MaxTemp?: number;
  };
  MachineSteps?: Array<{ Name: string; Temperature: number; Time: number; Drain: number; StepLocation: number }>;
  Fermentables?: Array<{ Name: string; Amount?: number; Color?: number }>;
  MashSteps?: Array<{ Name: string; Temp?: number; Time?: number }>;
  Hops?: Array<{ Name: string; Amount?: number; Alpha?: number; Time?: number }>;
  DryHops?: Array<{ Name: string; Amount?: number; Alpha?: number; Time?: number }>;
  Amendments?: Array<{ Name: string; Amount?: number; Unit?: string }>;
  FermentationSteps?: Array<{ Name: string; Temp?: number; Days?: number; Hours?: number }>;
};

function mapZPakToRecipeInput(r: PicoBrewRecipe): CreateRecipeInput {
  const notes = [r.Notes, r.TastingNotes ? `Tasting Notes: ${r.TastingNotes}` : null].filter(Boolean).join('\n\n');
  const yeastLabel = r.Yeast ? `${r.Yeast.Laboratory ?? ''} ${r.Yeast.Name ?? ''}`.trim() : '';

  return {
    name: r.Name ?? 'Imported Recipe',
    deviceType: DeviceType.PICOBREW_C,
    // Every recipe in this dataset is tagged "Z-Pack" (see scripts/tag-picobrew-recipe-types.py)
    // since every one ships full brew-science data (fermentables/hops/yeast/mash steps), not just
    // a machine step sequence — but read from the data rather than hardcoding, in case that changes.
    packType: r.Type?.toLowerCase().includes('pico') ? RecipePackType.PICOPACK : RecipePackType.ZPACK,
    abv: r.ABV ?? 0,
    ibu: r.IBU ?? 0,
    style: r.BeerStyle?.StyleNameCode ?? undefined,
    og: r.OG ?? undefined,
    fg: r.FG ?? undefined,
    colorSRM: r.SRM != null ? Math.round(r.SRM) : undefined,
    image: RecipeRepository.getDefaultImage(),
    notes: notes || undefined,
    batchSize: r.BatchSize ?? undefined,
    mashType: r.MashType ?? undefined,
    boilTime: r.BoilTime ?? undefined,
    boilTemp: r.BoilTemp ?? undefined,
    firstWortHopping: !!r.IsFirstWort,
    fermentationType: r.FermentationType ?? undefined,
    yeastName: yeastLabel || undefined,
    yeastAttenuation: r.Yeast?.ExpectedAtten ?? undefined,
    yeastRangeTemp: r.Yeast ? `${r.Yeast.MinTemp ?? '?'}-${r.Yeast.MaxTemp ?? '?'}` : undefined,
    yeastPitchTemp: r.Yeast?.ExpectedTemp != null ? Math.round(r.Yeast.ExpectedTemp) : undefined,
    steps: (r.MachineSteps ?? []).map((s) => ({
      name: s.Name,
      temperature: s.Temperature,
      stepTime: s.Time,
      drainTime: s.Drain,
      location: s.StepLocation,
    })),
    ingredients: [
      ...(r.Fermentables ?? []).map((f, i) => ({
        section: IngredientSection.FERMENTABLE,
        sortOrder: i,
        name: f.Name,
        amount: f.Amount ?? null,
        color: f.Color ?? null,
      })),
      ...(r.MashSteps ?? []).map((m, i) => ({
        section: IngredientSection.MASH_STEP,
        sortOrder: i,
        name: m.Name,
        temp: m.Temp != null ? Math.round(m.Temp) : null,
        time: m.Time != null ? Math.round(m.Time) : null,
      })),
      ...(r.Hops ?? []).map((h, i) => ({
        section: IngredientSection.BOIL_HOP,
        sortOrder: i,
        name: h.Name,
        amount: h.Amount ?? null,
        aa: h.Alpha ?? null,
        time: h.Time != null ? Math.round(h.Time) : null,
      })),
      ...(r.DryHops ?? []).map((h, i) => ({
        section: IngredientSection.DRY_HOP,
        sortOrder: i,
        name: h.Name,
        amount: h.Amount ?? null,
        aa: h.Alpha ?? null,
        time: h.Time != null ? Math.round(h.Time) : null,
      })),
      ...(r.Amendments ?? []).map((a, i) => ({
        section: IngredientSection.WATER,
        sortOrder: i,
        name: a.Name,
        amount: a.Amount ?? null,
        unit: a.Unit ?? null,
      })),
      ...(r.FermentationSteps ?? []).map((f, i) => ({
        section: IngredientSection.FERMENTATION_STEP,
        sortOrder: i,
        name: f.Name,
        temp: f.Temp != null ? Math.round(f.Temp) : null,
        days: f.Days != null ? Math.round(f.Days) : null,
        hours: f.Hours != null ? Math.round(f.Hours) : null,
      })),
    ],
  };
}

// PicoPak's format (the user's own vendor-API pull) — steps-only, no separate brew science, which
// is exactly this app's own "PicoPack" format (see app/pages/RecipeEditor/PicoPackEditor.tsx).
type PicoPakRecipe = {
  Name?: string;
  Abv?: number;
  Ibu?: number;
  Steps?: Array<{ Name: string; Temp: number; Time: number; Drain: number; Location: number }>;
};

// The vendor API's raw Steps arrays never include a "Preparing To Brew" step (that priming step
// is implicit on real hardware), and its location numbers don't match this app's own
// PicoLocationMap convention — every hand-authored PicoPack recipe here starts with
// Preparing To Brew@Prime / Heating@PassThru / Dough In@Mash (see PicoPackEditor.tsx's
// DEFAULT_MACHINE_STEPS), which is also what validatePicoRecipe requires. Heating and Dough In
// use different locations — confirmed on real hardware, see pico-recipe-validation.ts. So the
// mapper conforms imported steps to that same convention rather than passing the source Location
// through as-is.
function mapPicoPakToRecipeInput(r: PicoPakRecipe): CreateRecipeInput {
  const sourceSteps = (r.Steps ?? []).map((s) => ({
    name: s.Name,
    temperature: s.Temp,
    stepTime: s.Time,
    drainTime: s.Drain,
    location: s.Location,
  }));

  if (sourceSteps[0]?.name === 'Heating') {
    sourceSteps[0].location = PicoLocationMap.PassThru;
  }
  if (sourceSteps[1]?.name === 'Dough In') {
    sourceSteps[1].location = PicoLocationMap.Mash;
  }

  const steps = [
    { name: 'Preparing To Brew', temperature: 70, stepTime: 3, drainTime: 0, location: PicoLocationMap.Prime },
    ...sourceSteps,
  ];

  return {
    name: r.Name ?? 'Imported Recipe',
    deviceType: DeviceType.PICOBREW_C,
    packType: RecipePackType.PICOPACK,
    abv: r.Abv ?? 0,
    ibu: r.Ibu ?? 0,
    image: RecipeRepository.getDefaultImage(),
    steps,
    ingredients: [],
  };
}

export const action = async ({ request }: ActionFunctionArgs) => {
  await requireWriter(request);
  const body = await request.json();

  if (body.intent !== 'import') {
    return data({ error: 'Unknown intent' }, { status: 400 });
  }

  const tab: Tab = body.tab === 'community' || body.tab === 'picopak' ? body.tab : 'zpak';
  const id = String(body.id ?? '');

  try {
    if (tab === 'picopak') {
      if (!PICOPAK_ID_PATTERN.test(id)) {
        return data({ error: 'Invalid recipe id' }, { status: 400 });
      }
      let raw: string;
      try {
        raw = await fs.readFile(path.join(PICOPAK_DATA_DIR, 'picopaks', `${id}.json`), 'utf-8');
      } catch {
        return data({ error: 'Recipe not found' }, { status: 404 });
      }
      const recipe = JSON.parse(raw) as PicoPakRecipe;
      const created = await RecipeRepository.createRecipe(mapPicoPakToRecipeInput(recipe));
      return { success: true, recipeId: created.id };
    }

    if (!GUID_PATTERN.test(id)) {
      return data({ error: 'Invalid recipe id' }, { status: 400 });
    }
    let raw: string;
    try {
      raw = await fs.readFile(path.join(ZPAK_DATA_DIR, 'recipes', `${id}.json`), 'utf-8');
    } catch {
      return data({ error: 'Recipe not found' }, { status: 404 });
    }
    const recipeJson = JSON.parse(raw) as { VM?: { Recipe?: PicoBrewRecipe } };
    const recipe = recipeJson.VM?.Recipe;
    if (!recipe) {
      return data({ error: 'Malformed recipe file' }, { status: 500 });
    }
    const created = await RecipeRepository.createRecipe(mapZPakToRecipeInput(recipe));
    return { success: true, recipeId: created.id };
  } catch (error) {
    console.error('[picobrew-recipes] import failed', error);
    return data({ error: 'Import failed' }, { status: 500 });
  }
};
