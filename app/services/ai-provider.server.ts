import { ZEN_BASE_URL, ZEN_GO_BASE_URL, type ResolvedProvider } from '~/repositories/ai-settings.server';

// Shared low-level "call whichever AI provider is configured" plumbing, used by every AI feature
// in the app (the session AI Brewmaster Advisor, the AI Brewmaster recipe-generation sidekick,
// ...) so each new feature doesn't grow its own copy of the provider wire formats.

type ChatCompletionsProvider = Extract<ResolvedProvider, { kind: 'chat-completions' }>;
type ClaudeProvider = Extract<ResolvedProvider, { kind: 'claude' }>;

// OpenAI, OpenCode Zen, and any self-hosted OpenAI-compatible server (Ollama, LM Studio, vLLM,
// LocalAI, ...) all speak the same Chat Completions wire format, so one call function covers all
// three; only the base URL/key/model differ per provider (see AiSettingsRepository.getActiveProvider).
export async function callChatCompletions({
  baseUrl,
  apiKey,
  model,
  system,
  user,
  extraHeaders,
  maxTokens = 800,
  timeoutMs = 45000,
}: ChatCompletionsProvider & {
  system: string;
  user: string;
  extraHeaders?: Record<string, string>;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extraHeaders };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
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
export async function callAiProvider(
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
      });
}
