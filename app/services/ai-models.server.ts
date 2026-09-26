import { GEMINI_BASE_URL, OPENAI_BASE_URL } from '~/repositories/ai-settings.server';

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

// Gemini's OpenAI-compatible /models lists ids as "models/gemini-2.5-flash" alongside embedding, image, video and
// speech models; only the chat-capable Gemini ones are offered, without the "models/" prefix chat requests use.
const GEMINI_NON_CHAT_PATTERN = /embedding|tts|image|imagen|veo|live|audio|aqa|robotics|computer-use/i;

export async function listGeminiModels(apiKey: string): Promise<string[]> {
  const ids = await listChatCompletionsModels(GEMINI_BASE_URL, apiKey);
  return ids
    .map((id) => id.replace(/^models\//, ''))
    .filter((id) => id.startsWith('gemini') && !GEMINI_NON_CHAT_PATTERN.test(id))
    .sort();
}

// Keyless model suggestions from the public models.dev catalog, so the dropdowns are populated before an API key
// is entered. Cached in memory; the key-based lists above replace it once available.
type CatalogProvider = 'openai' | 'gemini' | 'claude';
const CATALOG_URL = 'https://models.dev/api.json';
const CATALOG_KEYS: Record<CatalogProvider, string> = { openai: 'openai', gemini: 'google', claude: 'anthropic' };
const CATALOG_TTL_MS = 24 * 60 * 60 * 1000;
let catalogCache: { at: number; data: Record<CatalogProvider, string[]> } | null = null;

type CatalogModel = { id: string; release_date?: string; tool_call?: boolean; modalities?: { output?: string[] } };

export async function listCatalogModels(): Promise<Record<CatalogProvider, string[]>> {
  if (catalogCache && Date.now() - catalogCache.at < CATALOG_TTL_MS) {
    return catalogCache.data;
  }
  const response = await fetch(CATALOG_URL, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    throw new Error(`Model catalog request failed (${response.status})`);
  }
  const json = (await response.json()) as Record<string, { models?: Record<string, CatalogModel> }>;
  const data = {} as Record<CatalogProvider, string[]>;
  for (const provider of Object.keys(CATALOG_KEYS) as CatalogProvider[]) {
    const models = Object.values(json[CATALOG_KEYS[provider]]?.models ?? {}).filter(
      (m) => m.tool_call !== false && (m.modalities?.output ?? ['text']).join() === 'text',
    );
    const isChatModel = (id: string) => {
      if (provider === 'gemini') {
        return id.startsWith('gemini') && !GEMINI_NON_CHAT_PATTERN.test(id);
      }
      return provider === 'openai' ? !NON_CHAT_PATTERN.test(id) : true;
    };
    const filtered = models.filter((m) => isChatModel(m.id));
    data[provider] = filtered
      .sort((a, b) => (b.release_date ?? '').localeCompare(a.release_date ?? ''))
      .map((m) => m.id);
  }
  catalogCache = { at: Date.now(), data };
  return data;
}
