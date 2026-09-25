import { OPENAI_BASE_URL } from '~/repositories/ai-settings.server';

const CLAUDE_MODELS_URL = 'https://api.anthropic.com/v1/models';

// Model ids that come back from OpenAI's /models list but aren't chat-completions models —
// filtered out so the dropdown only offers models `callChatCompletions` can actually use.
const NON_CHAT_PATTERN = /embedding|whisper|tts|dall-e|moderation|davinci|babbage|omni-moderation|audio/i;

export async function listOpenAiModels(apiKey: string): Promise<string[]> {
  const response = await fetch(`${OPENAI_BASE_URL}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`OpenAI request failed (${response.status}): ${body.slice(0, 200)}`);
  }
  const json = (await response.json()) as { data?: Array<{ id: string }> };
  const ids = (json.data ?? []).map((m) => m.id).filter((id) => !NON_CHAT_PATTERN.test(id));
  return ids.sort();
}

export async function listClaudeModels(apiKey: string): Promise<string[]> {
  const response = await fetch(CLAUDE_MODELS_URL, {
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Claude request failed (${response.status}): ${body.slice(0, 200)}`);
  }
  const json = (await response.json()) as { data?: Array<{ id: string }> };
  return (json.data ?? []).map((m) => m.id);
}

export async function listChatCompletionsModels(baseUrl: string, apiKey: string | null): Promise<string[]> {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/models`, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Request failed (${response.status}): ${body.slice(0, 200)}`);
  }
  const json = (await response.json()) as { data?: Array<{ id: string }> };
  return (json.data ?? []).map((m) => m.id).sort();
}

// Sanity-checks a chat-completions-style endpoint (OpenCode Zen/Go, or any self-hosted
// OpenAI-compatible server) before a Settings save persists it, so a typo'd key or unreachable
// host is caught immediately instead of surfacing as a mysterious failure the next time the
// scheduler or "Ask AI" tries to use it. GET /models is the de-facto standard this family of APIs
// implements for exactly this kind of check.
export async function verifyChatCompletionsAccess(baseUrl: string, apiKey: string | null): Promise<void> {
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, '')}/models`, { headers, signal: AbortSignal.timeout(10000) });
  } catch {
    throw new Error('Could not reach that endpoint.');
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error('That API key was rejected.');
  }
  if (!response.ok) {
    throw new Error(`Endpoint returned an error (${response.status}).`);
  }
}
