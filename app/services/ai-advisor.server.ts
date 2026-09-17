import { AiAdviceRepository, type AiAdviceTrigger } from '~/repositories/ai-advice.server';
import {
  AiSettingsRepository,
  ZEN_BASE_URL,
  ZEN_GO_BASE_URL,
  type ResolvedProvider,
} from '~/repositories/ai-settings.server';
import { BatchRepository } from '~/repositories/batch.server';
import { SessionRepository } from '~/repositories/session.server';
import pubsub from '~/services/pubsub.server';
import { BatchPhase, SessionType } from '~/types';

const MANUAL_COOLDOWN_MS = 2 * 60 * 1000;

type AnalyzeResult =
  | { success: true; advice: Awaited<ReturnType<typeof AiAdviceRepository.create>> }
  | { success: false; error: string };

const BREW_SESSION_TYPES: number[] = [SessionType.BREWING, SessionType.MANUAL_BREW, SessionType.COLD_BREW];

type BrewLogRow = { wort?: number; therm?: number; step?: string };
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

function buildBrewSummary(logs: Array<{ data: string }>) {
  const wort: number[] = [];
  const therm: number[] = [];
  let lastStep: string | null = null;
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
      }
    } catch {
      // skip malformed rows
    }
  }
  const wortStats = summarizeNumbers(wort);
  const thermStats = summarizeNumbers(therm);
  const lines = [`Current step: ${lastStep ?? 'unknown'}.`];
  if (wortStats) {
    lines.push(`Wort temp so far — min ${wortStats.min}°F, max ${wortStats.max}°F, avg ${wortStats.avg}°F.`);
  }
  if (thermStats) {
    lines.push(`ThermoBlock temp so far — min ${thermStats.min}°F, max ${thermStats.max}°F, avg ${thermStats.avg}°F.`);
  }
  return lines.join(' ');
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

async function buildPrompt(batch: NonNullable<Awaited<ReturnType<typeof BatchRepository.getBatch>>>) {
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
  if (batch.phase === BatchPhase.BREWING) {
    const brewSession = batch.sessions.find((s: { type: number }) => BREW_SESSION_TYPES.includes(s.type));
    const logs = brewSession ? await SessionRepository.listSessionLogs(brewSession.id) : [];
    stageSummary = buildBrewSummary(logs);
  } else if (batch.phase === BatchPhase.FERMENTING) {
    const fermSession = batch.sessions.find((s: { type: number }) => s.type === SessionType.FERMENTATION);
    const logs = fermSession ? await SessionRepository.listSessionLogs(fermSession.id) : [];
    stageSummary = buildFermentSummary(logs);
  }

  const userMessage = [`Phase: ${batch.phase}.`, recipeLines, stageSummary].filter(Boolean).join(' ');

  return {
    system:
      'You are an experienced, encouraging homebrew brewmaster embedded in RePicoBrew, a home brewing tracker app. ' +
      'Given the current stage and telemetry summary for a batch, give concise, specific, actionable advice in 2-4 short ' +
      'sentences of plain prose (no markdown, no headers, no bullet points — it renders in a small card). Flag genuine ' +
      "anomalies (stalled fermentation, temperature swings outside a safe range, mash temp off target) but don't invent " +
      'problems from normal readings — a brief reassurance that things look on track is a perfectly good response.',
    user: userMessage,
  };
}

type ChatCompletionsProvider = Extract<ResolvedProvider, { kind: 'chat-completions' }>;
type ClaudeProvider = Extract<ResolvedProvider, { kind: 'claude' }>;

// OpenAI, OpenCode Zen, and any self-hosted OpenAI-compatible server (Ollama, LM Studio, vLLM,
// LocalAI, ...) all speak the same Chat Completions wire format, so one call function covers all
// three; only the base URL/key/model differ per provider (see AiSettingsRepository.getActiveProvider).
async function callChatCompletions({
  baseUrl,
  apiKey,
  model,
  system,
  user,
  extraHeaders,
}: ChatCompletionsProvider & { system: string; user: string; extraHeaders?: Record<string, string> }): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extraHeaders };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      max_tokens: 800,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`AI provider request failed (${response.status}): ${body.slice(0, 200)}`);
  }

  const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('AI provider response had no content');
  }
  return content;
}

// Anthropic's Messages API — a different shape from the OpenAI family: `x-api-key` instead of a
// Bearer token, a required `anthropic-version` header, `system` as its own top-level field rather
// than a message, and content returned as an array of blocks instead of `choices[0].message`.
async function callClaude({
  apiKey,
  model,
  system,
  user,
}: ClaudeProvider & { system: string; user: string }): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      system,
      messages: [{ role: 'user', content: user }],
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Claude request failed (${response.status}): ${body.slice(0, 200)}`);
  }

  const json = (await response.json()) as { content?: Array<{ type?: string; text?: string }> };
  const content = json.content?.find((block) => block.type === 'text')?.text?.trim();
  if (!content) {
    throw new Error('Claude response had no content');
  }
  return content;
}

export async function analyzeBatch(batchId: number, trigger: AiAdviceTrigger): Promise<AnalyzeResult> {
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
    const { system, user } = await buildPrompt(batch);
    // OpenCode's gateway (Zen/Go) routes and prompt-caches by a stable per-conversation session id;
    // without it Go's /chat/completions rejects the request outright (MissingSessionID).
    const isOpenCodeGateway =
      provider.kind === 'chat-completions' &&
      (provider.baseUrl === ZEN_BASE_URL || provider.baseUrl === ZEN_GO_BASE_URL);
    const extraHeaders = isOpenCodeGateway ? { 'x-opencode-session': `repicobrew-batch-${batchId}` } : undefined;
    const content =
      provider.kind === 'claude'
        ? await callClaude({ ...provider, system, user })
        : await callChatCompletions({ ...provider, system, user, extraHeaders });
    const advice = await AiAdviceRepository.create({
      batchId,
      phase: batch.phase,
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
