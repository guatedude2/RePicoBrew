import { AiAdviceRepository, type AiAdviceTrigger } from '~/repositories/ai-advice.server';
import { AiSettingsRepository } from '~/repositories/ai-settings.server';
import { BatchRepository } from '~/repositories/batch.server';
import { SessionRepository } from '~/repositories/session.server';
import { callAiProvider, streamAiProvider } from '~/services/ai-provider.server';
import { PICOBREW_DOMAIN_KNOWLEDGE } from '~/services/picobrew-knowledge.server';
import pubsub from '~/services/pubsub.server';
import { BatchPhase, SessionType } from '~/types';

const MANUAL_COOLDOWN_MS = 2 * 60 * 1000;

type AnalyzeResult =
  | { success: true; advice: Awaited<ReturnType<typeof AiAdviceRepository.create>> }
  | { success: false; error: string };

const BREW_SESSION_TYPES: number[] = [SessionType.BREWING, SessionType.MANUAL_BREW, SessionType.COLD_BREW];

type BrewLogRow = { wort?: number; therm?: number; step?: string; timeLeft?: number };
type FermLogRow = { temp?: number; gravity?: number };
function summarizeNumbers(values: number[]) {
  if (values.length === 0) {
    return null;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  return { min: Math.round(min * 100) / 100, max: Math.round(max * 100) / 100, avg: Math.round(avg * 100) / 100 };
}

type RecipeStepInfo = { name: string; temperature: number; stepTime: number; drainTime: number };

function buildBrewSummary(logs: Array<{ data: string; time?: Date }>, recipeSteps: RecipeStepInfo[] = []) {
  const wort: number[] = [];
  const therm: number[] = [];
  const stepsSeen: string[] = [];
  let lastStep: string | null = null;
  let timeLeft: number | null = null;
  for (const log of logs) {
    try {
      const row = JSON.parse(log.data) as BrewLogRow;
      if (typeof row.wort === 'number') {
        wort.push(row.wort);
      }
      if (typeof row.therm === 'number') {
        therm.push(row.therm);
      }
      if (typeof row.step === 'string' && row.step) {
        lastStep = row.step;
        if (stepsSeen[stepsSeen.length - 1] !== row.step) {
          stepsSeen.push(row.step);
        }
      }
      if (typeof row.timeLeft === 'number') {
        timeLeft = row.timeLeft;
      }
    } catch {
      // skip malformed rows
    }
  }
  const wortStats = summarizeNumbers(wort);
  const thermStats = summarizeNumbers(therm);
  const lines = [`Current step: ${lastStep ?? 'unknown'}.`];
  if (recipeSteps.length > 0) {
    lines.push(
      `Recipe step plan: ${recipeSteps
        .map((step) => `${step.name} ${step.temperature}°F for ${step.stepTime} min`)
        .join('; ')}.`,
    );
  }
  const target = lastStep ? recipeSteps.find((step) => step.name.toLowerCase() === lastStep.toLowerCase()) : undefined;
  if (target) {
    lines.push(
      `The recipe calls for ${target.temperature}°F for ${target.stepTime} min${
        target.drainTime ? ` then ${target.drainTime} min draining` : ''
      } on this step.`,
    );
  }
  if (stepsSeen.length > 1) {
    lines.push(`Steps so far: ${stepsSeen.join(' → ')}.`);
  }
  if (timeLeft !== null) {
    lines.push(`About ${Math.max(0, Math.round(timeLeft / 60))} minutes of the whole brew remain.`);
  }
  const latestWort = wort[wort.length - 1];
  if (latestWort !== undefined) {
    lines.push(`Latest wort temp ${latestWort}°F.`);
  }
  // The last few readings, oldest first, so questions about "right now" and the trend can be answered.
  const recent = logs.slice(-6).flatMap((log) => {
    try {
      const row = JSON.parse(log.data) as BrewLogRow;
      if (typeof row.wort !== 'number' && typeof row.therm !== 'number') {
        return [];
      }
      const ageMin = log.time ? Math.max(0, Math.round((Date.now() - log.time.getTime()) / 60000)) : null;
      return [
        `${ageMin !== null ? `${ageMin} min ago` : 'earlier'}: wort ${row.wort ?? '?'}°F, ThermoBlock ${
          row.therm ?? '?'
        }°F (${row.step ?? '?'})`,
      ];
    } catch {
      return [];
    }
  });
  if (recent.length > 0) {
    lines.push(`Most recent readings — ${recent.join('; ')}.`);
  }
  if (wortStats) {
    lines.push(`Wort temp so far — min ${wortStats.min}°F, max ${wortStats.max}°F, avg ${wortStats.avg}°F.`);
  }
  if (thermStats) {
    lines.push(`ThermoBlock temp so far — min ${thermStats.min}°F, max ${thermStats.max}°F, avg ${thermStats.avg}°F.`);
  }
  return { summary: lines.join(' '), step: lastStep };
}

// How far into the recipe's expected fermentation window this batch actually is right now — the
// prompt otherwise only knows the *target* length (see recipeLines below), with no way to tell
// "day 1 of 7, totally normal" from "day 6 of 7, should be close to done".
function describeFermentationProgress(startedAt: Date, fermentDays: number | null | undefined): string {
  const elapsedMs = Date.now() - new Date(startedAt).getTime();
  const elapsedDays = elapsedMs / 86400000;
  if (!fermentDays) {
    return `Fermenting for ${elapsedDays.toFixed(1)} days so far.`;
  }
  const remainingDays = Math.max(0, fermentDays - elapsedDays);
  return remainingDays <= 0
    ? `Day ${elapsedDays.toFixed(1)} of an expected ${fermentDays} — past the expected window.`
    : `Day ${elapsedDays.toFixed(1)} of an expected ${fermentDays} (about ${remainingDays.toFixed(1)} days left).`;
}

function buildFermentSummary(logs: Array<{ data: string; time: Date }>) {
  const temps: number[] = [];
  const gravities: number[] = [];
  for (const log of logs) {
    try {
      const row = JSON.parse(log.data) as FermLogRow;
      if (typeof row.temp === 'number') {
        temps.push(row.temp);
      }
      if (typeof row.gravity === 'number') {
        gravities.push(row.gravity);
      }
    } catch {
      // skip malformed rows
    }
  }
  const tempStats = summarizeNumbers(temps);
  const lines: string[] = [];
  if (tempStats) {
    lines.push(`Fermentation temp — min ${tempStats.min}°F, max ${tempStats.max}°F, avg ${tempStats.avg}°F.`);
  }
  if (gravities.length >= 2) {
    const first = gravities[0];
    const last = gravities[gravities.length - 1];
    lines.push(
      `Specific gravity trend — started this window at ${first.toFixed(3)}, now ${last.toFixed(3)} (${
        last < first ? 'dropping' : last > first ? 'rising' : 'flat'
      }).`,
    );
  } else if (gravities.length === 1) {
    lines.push(`Current specific gravity: ${gravities[0].toFixed(3)}.`);
  }
  return lines.length > 0 ? lines.join(' ') : 'No fermentation readings yet.';
}

// Everything the AI is told about a batch: recipe, the phase, and live telemetry for it (current step, the
// recipe's target for that step, recent readings, ...). Shared by the scheduled/step advice and the chat.
async function buildBatchContext(batch: NonNullable<Awaited<ReturnType<typeof BatchRepository.getBatch>>>) {
  const recipe = batch.recipe;
  const recipeLines = recipe
    ? [
        `Recipe: ${recipe.name}${recipe.style ? ` (${recipe.style})` : ''}.`,
        `Targets — OG ${recipe.og ?? '—'}, FG ${recipe.fg ?? '—'}, ABV ${recipe.abv}%, IBU ${recipe.ibu}.`,
        recipe.fermentDays ? `Expected fermentation length: ${recipe.fermentDays} days.` : '',
      ]
        .filter(Boolean)
        .join(' ')
    : 'No recipe details attached to this batch.';

  let stageSummary = '';
  let step: string | null = null;
  if (batch.phase === BatchPhase.BREWING) {
    const brewSession = batch.sessions.find((s: { type: number }) => BREW_SESSION_TYPES.includes(s.type));
    const logs = brewSession ? await SessionRepository.listSessionLogs(brewSession.id) : [];
    const brew = buildBrewSummary(logs, batch.recipe?.steps ?? []);
    stageSummary = brew.summary;
    step = brew.step;
  } else if (batch.phase === BatchPhase.FERMENTING) {
    const fermSession = batch.sessions.find((s: { type: number }) => s.type === SessionType.FERMENTATION);
    const logs = fermSession ? await SessionRepository.listSessionLogs(fermSession.id) : [];
    const progress = fermSession ? describeFermentationProgress(fermSession.createdAt, recipe?.fermentDays) : '';
    stageSummary = [progress, buildFermentSummary(logs)].filter(Boolean).join(' ');
  }

  return {
    text: [`Batch: ${batch.name}. Phase: ${batch.phase}.`, recipeLines, stageSummary].filter(Boolean).join(' '),
    step,
  };
}

// For the chat panel on a session page: the same live context, or null if the batch doesn't exist.
export async function describeBatchForChat(batchId: number): Promise<string | null> {
  const batch = await BatchRepository.getBatch(batchId);
  if (!batch) {
    return null;
  }
  return (await buildBatchContext(batch)).text;
}

async function buildPrompt(batch: NonNullable<Awaited<ReturnType<typeof BatchRepository.getBatch>>>) {
  const { text: userMessage, step } = await buildBatchContext(batch);

  const basePrompt =
    'You are an experienced, encouraging homebrew brewmaster embedded in RePicoBrew, a home brewing tracker app. ' +
    'Given the current stage and telemetry summary for a batch, give concise, specific, actionable advice in 2-4 short ' +
    'sentences of plain prose (no markdown, no headers, no bullet points — it renders in a small card). While brewing, ' +
    'focus on the step the brew is on right now: what is happening, what to watch for, and what comes next. Flag genuine ' +
    "anomalies (stalled fermentation, temperature swings outside a safe range, mash temp off target) but don't invent " +
    'problems from normal readings — a brief reassurance that things look on track is a perfectly good response.';

  return {
    system: `${basePrompt}\n\n${PICOBREW_DOMAIN_KNOWLEDGE}`,
    user: userMessage,
    step,
  };
}

export async function analyzeBatch(
  batchId: number,
  trigger: AiAdviceTrigger,
  onDelta?: (text: string) => void,
): Promise<AnalyzeResult> {
  const provider = await AiSettingsRepository.getActiveProvider();
  if (!provider) {
    return { success: false, error: 'No AI provider is configured.' };
  }

  if (trigger === 'manual') {
    const latest = await AiAdviceRepository.getLatestForBatch(batchId);
    if (latest && Date.now() - latest.createdAt.getTime() < MANUAL_COOLDOWN_MS) {
      const waitSec = Math.ceil((MANUAL_COOLDOWN_MS - (Date.now() - latest.createdAt.getTime())) / 1000);
      return { success: false, error: `Please wait ${waitSec}s before asking again.` };
    }
  }

  const batch = await BatchRepository.getBatch(batchId);
  if (!batch) {
    return { success: false, error: 'Batch not found.' };
  }
  if (batch.phase !== BatchPhase.BREWING && batch.phase !== BatchPhase.FERMENTING) {
    return { success: false, error: 'AI advice is only available during Brewing or Fermenting.' };
  }

  try {
    const { system, user, step } = await buildPrompt(batch);
    // OpenCode's gateway (Zen/Go) routes and prompt-caches by a stable per-conversation session id;
    // without it Go's /chat/completions rejects the request outright (MissingSessionID).
    const request = { system, user, sessionId: `repicobrew-batch-${batchId}` };
    const content = onDelta
      ? await streamAiProvider(provider, request, onDelta)
      : await callAiProvider(provider, request);
    const advice = await AiAdviceRepository.create({
      batchId,
      phase: batch.phase,
      step,
      trigger,
      content,
      model: provider.model,
    });
    pubsub.publish('ai-advice-ready', { batchId, advice });
    return { success: true, advice };
  } catch (error) {
    console.error('[ai-advisor] analyzeBatch failed', error);
    return { success: false, error: 'The AI request failed. Try again in a moment.' };
  }
}
