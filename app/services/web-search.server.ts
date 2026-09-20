import { AiSettingsRepository } from '~/repositories/ai-settings.server';

// Web search for the AI Brewmaster via the Brave Search API (https://brave.com/search/api/). The model
// itself can't browse, so the app searches on its behalf and hands the results to the model as
// reference material. Only used once the user has added a key in Settings -> AI.

export type SearchResult = { title: string; url: string; description: string };

// Overridable so the search flow can be exercised against a local stand-in without a real key.
const SEARCH_ENDPOINT = process.env.BRAVE_SEARCH_ENDPOINT || 'https://api.search.brave.com/res/v1/web/search';

async function braveSearch(apiKey: string, query: string, count: number): Promise<SearchResult[]> {
  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(count));
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'X-Subscription-Token': apiKey },
    signal: AbortSignal.timeout(10000),
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error('Brave rejected that API key.');
  }
  if (!response.ok) {
    throw new Error(`Brave Search answered ${response.status}.`);
  }
  const json = (await response.json()) as {
    web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
  };
  return (json.web?.results ?? [])
    .filter((r) => r.url && r.title)
    .map((r) => ({
      title: (r.title ?? '').replace(/<[^>]+>/g, '').trim(),
      url: r.url as string,
      description: (r.description ?? '').replace(/<[^>]+>/g, '').trim(),
    }));
}

export async function verifySearchKey(apiKey: string): Promise<void> {
  await braveSearch(apiKey, 'homebrew beer recipe', 1);
}

// Returns null when no key is configured or the search fails — callers carry on without it.
export async function searchWeb(query: string, count = 5): Promise<SearchResult[] | null> {
  const apiKey = await AiSettingsRepository.getSearchApiKeyPlain();
  if (!apiKey) {
    return null;
  }
  try {
    return await braveSearch(apiKey, query, count);
  } catch (error) {
    console.error('[web-search] search failed', error);
    return null;
  }
}
