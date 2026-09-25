import { AiSettingsRepository } from '~/repositories/ai-settings.server';
import { callAiProvider, describeAiError } from '~/services/ai-provider.server';

// Fills in the gravity targets a PicoPack recipe doesn't carry (PicoBrew's pak format has steps only): an estimated
// original gravity, final gravity and yeast attenuation from the grain bill, hops, yeast, style and the recipe's
// stated ABV. These feed the fermentation chart's expected/projected gravity lines and the AI advice; the user
// reviews them in the editor and they are only saved with the recipe.

export type GravityEstimateInput = {
  name: string;
  style?: string | null;
  abv?: number | null;
  ibu?: number | null;
  notes?: string | null;
  batchLiters: number;
  yeastName?: string | null;
  yeastAmountGrams?: number | null;
  grains: Array<{ name: string; ounces: number }>;
  hops: Array<{ name: string; ounces: number }>;
};

export type GravityEstimate = {
  og: number;
  fg: number;
  attenuation: number;
  tempMin: number | null;
  tempMax: number | null;
  explanation: string;
};
export type GravityEstimateResult = ({ success: true } & GravityEstimate) | { success: false; error: string };

const SYSTEM =
  'You are an experienced homebrewer estimating the gravity numbers of a recipe that only lists its ingredients. ' +
  "Estimate the original gravity (OG), the final gravity (FG) and the yeast's apparent attenuation for THIS recipe, " +
  'from the grain bill and batch size (assume roughly 70-75% brewhouse efficiency), the style, the yeast, and the ' +
  "recipe's stated ABV — the ABV should roughly equal (OG - FG) x 131.25, so pick numbers consistent with it. " +
  'Also give the fermentation temperature range in degrees Fahrenheit that suits this beer and its yeast (e.g. ' +
  'a clean American ale yeast: 64 to 72). ' +
  'Respond with ONLY one JSON object, no markdown: {"og": 1.0xx, "fg": 1.0xx, "attenuation": <percent number>, ' +
  '"tempMinF": <number>, "tempMaxF": <number>, "explanation": "one or two short sentences on how you got there"}. ' +
  'OG and FG are specific gravities with three decimals (e.g. 1.056 and 1.012); attenuation is apparent attenuation as ' +
  'a percentage (e.g. 79).';

const OZ_PER_LB = 16;
const GAL_PER_L = 0.264172;

function parseJson(raw: string): Record<string, unknown> | null {
  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    text = fenced[1].trim();
  }
  const a = text.indexOf('{');
  const b = text.lastIndexOf('}');
  if (a === -1 || b < a) {
    return null;
  }
  try {
    const parsed = JSON.parse(text.slice(a, b + 1));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN);
const round3 = (n: number) => Math.round(n * 1000) / 1000;

export async function estimateGravityTargets(input: GravityEstimateInput): Promise<GravityEstimateResult> {
  const provider = await AiSettingsRepository.getActiveProvider();
  if (!provider) {
    return { success: false, error: 'No AI provider is configured. Add one in Settings → AI.' };
  }
  if (input.grains.length === 0) {
    return { success: false, error: 'Add the grain bill first so the AI has something to estimate from.' };
  }

  const gallons = input.batchLiters * GAL_PER_L;
  const totalLb = input.grains.reduce((sum, g) => sum + g.ounces / OZ_PER_LB, 0);
  const lines = [
    `Recipe: ${input.name}${input.style ? ` (${input.style})` : ''}.`,
    `Batch: ${input.batchLiters} L (${gallons.toFixed(2)} gal).`,
    `Grain bill (${totalLb.toFixed(2)} lb total): ${input.grains
      .map((g) => `${g.name} ${(g.ounces / OZ_PER_LB).toFixed(2)} lb`)
      .join('; ')}.`,
    input.hops.length ? `Hops: ${input.hops.map((h) => `${h.name} ${h.ounces.toFixed(2)} oz`).join('; ')}.` : '',
    input.yeastName || input.yeastAmountGrams
      ? `Yeast: ${input.yeastName || 'dry yeast'}${input.yeastAmountGrams ? ` (${input.yeastAmountGrams} g)` : ''}.`
      : '',
    input.abv != null && input.abv > 0 ? `Stated ABV: ${input.abv}%.` : '',
    input.ibu != null && input.ibu > 0 ? `Stated IBU: ${input.ibu}.` : '',
    input.notes?.trim() ? `Notes: ${input.notes.trim().slice(0, 400)}` : '',
  ].filter(Boolean);

  let raw: string;
  try {
    raw = await callAiProvider(provider, {
      system: SYSTEM,
      user: lines.join('\n'),
      maxTokens: 400,
      timeoutMs: 60000,
      sessionId: 'repicobrew-gravity-estimate',
    });
  } catch (error) {
    console.error('[ai-gravity-estimator] request failed', error);
    return { success: false, error: describeAiError(error) };
  }

  const parsed = parseJson(raw);
  const og = parsed ? num(parsed.og) : NaN;
  const fg = parsed ? num(parsed.fg) : NaN;
  let attenuation = parsed ? num(parsed.attenuation) : NaN;
  if (!parsed || !Number.isFinite(og) || !Number.isFinite(fg)) {
    console.error('[ai-gravity-estimator] could not parse AI response', raw.slice(0, 300));
    return { success: false, error: 'The AI response could not be understood. Try again.' };
  }
  // The model is untrusted: reject anything outside what a beer can plausibly be.
  if (og < 1.02 || og > 1.13 || fg < 0.996 || fg > 1.04 || fg >= og) {
    return { success: false, error: 'The AI returned implausible gravity numbers. Try again.' };
  }
  if (!Number.isFinite(attenuation) || attenuation < 40 || attenuation > 100) {
    attenuation = ((og - fg) / (og - 1)) * 100;
  }
  // The temperature range is a bonus: kept only when it is a sane min < max in °F, otherwise ignored.
  const tMin = num(parsed.tempMinF);
  const tMax = num(parsed.tempMaxF);
  const tempOk = Number.isFinite(tMin) && Number.isFinite(tMax) && tMin >= 30 && tMax <= 100 && tMin < tMax;
  const explanation = typeof parsed.explanation === 'string' ? parsed.explanation.trim().slice(0, 400) : '';
  return {
    success: true,
    og: round3(og),
    fg: round3(fg),
    attenuation: Math.round(attenuation * 10) / 10,
    tempMin: tempOk ? Math.round(tMin) : null,
    tempMax: tempOk ? Math.round(tMax) : null,
    explanation,
  };
}
