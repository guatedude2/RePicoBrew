// Web search for the AI Brewmaster via a SearXNG instance (https://docs.searxng.org/) the user runs
// themselves — free, no API key. The model can't browse, so the app searches on its behalf and hands
// the results to the model as reference material. The instance is set by the SEARXNG_URL environment
// variable (default: the SearXNG the Pi install sets up on 127.0.0.1:8888; set it to an empty string to turn
// web search off). The instance must allow JSON output (`json` under `search.formats` in its settings.yml);
// public instances almost always turn that off.

export type SearchResult = { title: string; url: string; description: string };

const DEFAULT_SEARXNG_URL = 'http://127.0.0.1:8888';

function configuredSearchUrl(): string | null {
  const raw = (process.env.SEARXNG_URL ?? DEFAULT_SEARXNG_URL).trim();
  return raw ? raw.replace(/\/+$/, '') : null;
}

async function searxngSearch(baseUrl: string, query: string, count: number): Promise<SearchResult[]> {
  const url = new URL(`${baseUrl}/search`);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('language', 'en');
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'RePicoBrew/1.0' },
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 403) {
    throw new Error(
      'That SearXNG instance refuses JSON results. Add "json" to search.formats in its settings.yml, or use your own instance.',
    );
  }
  if (!response.ok) {
    throw new Error(`The SearXNG instance answered ${response.status}.`);
  }
  const json = (await response.json().catch(() => null)) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  } | null;
  if (!json || !Array.isArray(json.results)) {
    throw new Error('That address did not return SearXNG JSON results.');
  }
  return json.results
    .filter((r) => r.url && r.title)
    .slice(0, count)
    .map((r) => ({
      title: (r.title ?? '').replace(/<[^>]+>/g, '').trim(),
      url: r.url as string,
      description: (r.content ?? '').replace(/<[^>]+>/g, '').trim(),
    }));
}

// Returns null when no instance is configured or the search fails — callers carry on without it.
export async function searchWeb(query: string, count = 5): Promise<SearchResult[] | null> {
  const baseUrl = configuredSearchUrl();
  if (!baseUrl) {
    return null;
  }
  try {
    return await searxngSearch(baseUrl, query, count);
  } catch (error) {
    console.error('[web-search] search failed', error);
    return null;
  }
}
