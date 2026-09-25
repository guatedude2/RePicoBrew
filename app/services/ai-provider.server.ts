import {
  AiSettingsRepository,
  GEMINI_BASE_URL,
  ZEN_BASE_URL,
  ZEN_GO_BASE_URL,
  type ResolvedProvider,
} from '~/repositories/ai-settings.server';
import { listGeminiModels } from '~/services/ai-models.server';
import { pickGeminiModel } from '~/utils/gemini-models';

// Shared low-level "call whichever AI provider is configured" plumbing, used by every AI feature
// in the app (the session AI Brewmaster Advisor, the AI Brewmaster recipe-generation sidekick,
// ...) so each new feature doesn't grow its own copy of the provider wire formats.

type ChatCompletionsProvider = Extract<ResolvedProvider, { kind: 'chat-completions' }>;
type ClaudeProvider = Extract<ResolvedProvider, { kind: 'claude' }>;

// OpenAI, OpenCode Zen, and any self-hosted OpenAI-compatible server (Ollama, LM Studio, vLLM,
// LocalAI, ...) all speak the same Chat Completions wire format, so one call function covers all
// three; only the base URL/key/model differ per provider (see AiSettingsRepository.getActiveProvider).
// Reasoning models (e.g. Kimi K3 on OpenCode Go) count their hidden thinking against max_tokens, so a
// budget sized for the visible answer alone is often spent entirely on reasoning and the reply comes
// back empty (finish_reason "length"). Non-reasoning models only treat this as an upper bound.
const REASONING_TOKEN_HEADROOM = 4000;

export async function callChatCompletions({
  baseUrl,
  apiKey,
  model,
  system,
  user,
  extraHeaders,
  reasoningEffort,
  maxTokens = 800,
  timeoutMs = 45000,
}: ChatCompletionsProvider & {
  system: string;
  user: string;
  extraHeaders?: Record<string, string>;
  reasoningEffort?: 'low';
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extraHeaders };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const send = (withReasoningEffort: boolean) =>
    fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        max_tokens: maxTokens + REASONING_TOKEN_HEADROOM,
        ...(withReasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

  let response = await send(Boolean(reasoningEffort));
  // Not every model behind a gateway accepts reasoning_effort — retry once without it rather than fail.
  if (reasoningEffort && response.status === 400) {
    response = await send(false);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`AI provider request failed (${response.status}): ${body.slice(0, 200)}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  };
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error(
      `AI provider response had no content (finish_reason: ${json.choices?.[0]?.finish_reason ?? 'n/a'})`,
    );
  }
  return content;
}

// Anthropic's Messages API — a different shape from the OpenAI family: `x-api-key` instead of a
// Bearer token, a required `anthropic-version` header, `system` as its own top-level field rather
// than a message, and content returned as an array of blocks instead of `choices[0].message`.
export async function callClaude({
  apiKey,
  model,
  system,
  user,
  maxTokens = 800,
  timeoutMs = 45000,
}: ClaudeProvider & {
  system: string;
  user: string;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
    signal: AbortSignal.timeout(timeoutMs),
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

function isOpenCodeGateway(provider: ResolvedProvider): boolean {
  return (
    provider.kind === 'chat-completions' && (provider.baseUrl === ZEN_BASE_URL || provider.baseUrl === ZEN_GO_BASE_URL)
  );
}

// Single entry point every AI feature should call: resolves the wire format for whichever
// provider is active and (for OpenCode's gateway, which requires a stable per-conversation
// session id or it rejects the request outright) attaches the routing/prompt-cache header.
async function callAiProviderOnce(
  provider: ResolvedProvider,
  args: { system: string; user: string; maxTokens?: number; timeoutMs?: number; sessionId?: string },
): Promise<string> {
  const extraHeaders =
    isOpenCodeGateway(provider) && args.sessionId ? { 'x-opencode-session': args.sessionId } : undefined;
  return provider.kind === 'claude'
    ? callClaude({
        ...provider,
        system: args.system,
        user: args.user,
        maxTokens: args.maxTokens,
        timeoutMs: args.timeoutMs,
      })
    : callChatCompletions({
        ...provider,
        system: args.system,
        user: args.user,
        maxTokens: args.maxTokens,
        timeoutMs: args.timeoutMs,
        extraHeaders,
        // OpenCode's gateway serves reasoning models (e.g. Kimi K3) that otherwise think for 30-60s and can
        // spend the whole token budget doing it; these tasks (recipe JSON, short chat replies) don't need it.
        reasoningEffort: isOpenCodeGateway(provider) ? 'low' : undefined,
      });
}

// Reads a `text/event-stream` body and calls `onData` with each event's `data:` payload.
async function readSseData(response: Response, onData: (payload: string) => void): Promise<void> {
  if (!response.body) {
    throw new Error('AI provider returned no response body');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.startsWith('data:')) {
        onData(line.slice(5).trim());
      }
    }
  }
  if (buffer.startsWith('data:')) {
    onData(buffer.slice(5).trim());
  }
}

// Same request as callAiProvider, but the reply is streamed: `onDelta` gets each new piece of text as it
// arrives and the full text is returned at the end.
async function streamAiProviderOnce(
  provider: ResolvedProvider,
  args: { system: string; user: string; maxTokens?: number; timeoutMs?: number; sessionId?: string },
  onDelta: (text: string) => void,
): Promise<string> {
  const maxTokens = args.maxTokens ?? 800;
  const signal = AbortSignal.timeout(args.timeoutMs ?? 45000);
  let full = '';
  const push = (text: string | undefined) => {
    if (text) {
      full += text;
      onDelta(text);
    }
  };

  if (provider.kind === 'claude') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': provider.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: maxTokens,
        stream: true,
        system: args.system,
        messages: [{ role: 'user', content: args.user }],
      }),
      signal,
    });
    if (!response.ok) {
      throw new Error(
        `Claude request failed (${response.status}): ${(await response.text().catch(() => '')).slice(0, 200)}`,
      );
    }
    await readSseData(response, (payload) => {
      try {
        const event = JSON.parse(payload) as { type?: string; delta?: { type?: string; text?: string } };
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          push(event.delta.text);
        }
      } catch {
        // keep-alive / non-JSON line
      }
    });
  } else {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (provider.apiKey) {
      headers.Authorization = `Bearer ${provider.apiKey}`;
    }
    if (isOpenCodeGateway(provider) && args.sessionId) {
      headers['x-opencode-session'] = args.sessionId;
    }
    const reasoningEffort = isOpenCodeGateway(provider) ? 'low' : undefined;
    const send = (withReasoningEffort: boolean) =>
      fetch(`${provider.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: provider.model,
          max_tokens: maxTokens + REASONING_TOKEN_HEADROOM,
          stream: true,
          ...(withReasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
          messages: [
            { role: 'system', content: args.system },
            { role: 'user', content: args.user },
          ],
        }),
        signal,
      });
    let response = await send(Boolean(reasoningEffort));
    if (reasoningEffort && response.status === 400) {
      response = await send(false);
    }
    if (!response.ok) {
      throw new Error(
        `AI provider request failed (${response.status}): ${(await response.text().catch(() => '')).slice(0, 200)}`,
      );
    }
    await readSseData(response, (payload) => {
      if (payload === '[DONE]') {
        return;
      }
      try {
        const event = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
        push(event.choices?.[0]?.delta?.content);
      } catch {
        // keep-alive / non-JSON line
      }
    });
  }

  const text = full.trim();
  if (!text) {
    throw new Error('AI provider stream had no content');
  }
  return text;
}

// The provider calls above throw `AI provider request failed (<status>): <body>` (or the Claude equivalent). Turns
// that into something the user can act on — a used-up quota or rate limit and a rejected API key are by far the most
// common causes — instead of a generic "the request failed".
export function describeAiError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  const status = Number(text.match(/\((\d{3})\)/)?.[1]);
  let detail = '';
  // Bodies are JSON objects, or (Gemini) a one-element array of them.
  const start = text.search(/[[{]/);
  try {
    const raw = JSON.parse(start >= 0 ? text.slice(start) : '') as unknown;
    const parsed = (Array.isArray(raw) ? raw[0] : raw) as {
      error?: { message?: string } | string;
      metadata?: { limitName?: string };
    };
    const message = typeof parsed?.error === 'string' ? parsed.error : parsed?.error?.message;
    detail = [
      message?.split('\n')[0].slice(0, 160),
      parsed?.metadata?.limitName ? `${parsed.metadata.limitName} limit` : '',
    ]
      .filter(Boolean)
      .join(', ');
  } catch {
    // body wasn't JSON; fall through to the status-only messages
  }
  const suffix = detail ? ` (${detail})` : '';
  if (/FreeTierError|free tier can only be used from within OpenCode/i.test(text)) {
    return 'OpenCode refused the request: its free tier can only be used from within OpenCode itself. Add an OpenCode API key in Settings → AI (free models still cost nothing with a key), or switch provider.';
  }
  if (status === 404) {
    return `The AI provider says the model isn't available${suffix}. Choose another model in Settings → AI.`;
  }
  if (status === 429) {
    return `The AI provider has refused the request because its usage or rate limit was reached${suffix}. Try again later, or switch provider in Settings → AI.`;
  }
  if (status === 401 || status === 403 || /API key not valid|API_KEY_INVALID|pass a valid API key/i.test(text)) {
    return `The AI provider rejected the API key${suffix}. Check it in Settings → AI.`;
  }
  if (status === 402) {
    return `The AI provider says the account is out of credit${suffix}. Add credit, or switch provider in Settings → AI.`;
  }
  if (/aborted|timeout|timed out/i.test(text)) {
    return 'The AI provider took too long to answer. Try again in a moment.';
  }
  return 'The AI request failed. Try again in a moment.';
}

// A Gemini model can be retired under a saved config ("no longer available to new users"). When a request fails for
// that reason, pick the newest Flash model the key can see, save it as the model, and retry once.
async function recoverGeminiModel(provider: ResolvedProvider, error: unknown): Promise<ResolvedProvider | null> {
  if (provider.kind !== 'chat-completions' || provider.baseUrl !== GEMINI_BASE_URL || !provider.apiKey) {
    return null;
  }
  const text = error instanceof Error ? error.message : String(error);
  if (!/\(404\)/.test(text) || !/no longer available|not found|not supported/i.test(text)) {
    return null;
  }
  try {
    const best = pickGeminiModel(await listGeminiModels(provider.apiKey));
    if (!best || best === provider.model) {
      return null;
    }
    console.warn(`[ai-provider] Gemini model ${provider.model} is unavailable; switching to ${best}`);
    await AiSettingsRepository.updateGeminiModel(best);
    return { ...provider, model: best };
  } catch {
    return null;
  }
}

export async function callAiProvider(
  provider: ResolvedProvider,
  args: { system: string; user: string; maxTokens?: number; timeoutMs?: number; sessionId?: string },
): Promise<string> {
  try {
    return await callAiProviderOnce(provider, args);
  } catch (error) {
    const recovered = await recoverGeminiModel(provider, error);
    if (!recovered) {
      throw error;
    }
    return callAiProviderOnce(recovered, args);
  }
}

export async function streamAiProvider(
  provider: ResolvedProvider,
  args: { system: string; user: string; maxTokens?: number; timeoutMs?: number; sessionId?: string },
  onDelta: (text: string) => void,
): Promise<string> {
  try {
    return await streamAiProviderOnce(provider, args, onDelta);
  } catch (error) {
    const recovered = await recoverGeminiModel(provider, error);
    if (!recovered) {
      throw error;
    }
    return streamAiProviderOnce(recovered, args, onDelta);
  }
}
