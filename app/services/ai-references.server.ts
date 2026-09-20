import { callAiProvider } from '~/services/ai-provider.server';
import { fetchReferences, fetchUrls, type FetchedReference } from '~/services/reference-fetch.server';
import { searchWeb, type SearchResult } from '~/services/web-search.server';
import type { ResolvedProvider } from '~/repositories/ai-settings.server';

// Everything the AI Brewmaster is allowed to treat as "looked up" material for one request: pages the
// user linked, and — when a SearXNG instance is configured — pages found by searching for what they named.

export type GatheredReferences = {
  references: FetchedReference[];
  searchQuery: string | null;
  results: SearchResult[];
};

const PAGES_TO_READ = 2;

const PLANNER_SYSTEM = `You decide whether answering a homebrewing request needs a web lookup. If the user names a specific
external beer, brewery, kit, book, website or recipe they want matched or used as a basis (e.g. "like the Brooklyn Brew
Shop Everyday IPA", "clone Sierra Nevada Torpedo"), return the best web search query (at most 10 words, include the
words "recipe" or "ingredients" and the exact product name). If the request is generic ("more bitterness", "how do I
clean the machine") or about something already visible in the app, return null. Respond with ONLY JSON: {"query": string | null}`;

async function planSearchQuery(provider: ResolvedProvider, text: string): Promise<string | null> {
  try {
    const raw = await callAiProvider(provider, {
      system: PLANNER_SYSTEM,
      user: text.slice(0, 1500),
      maxTokens: 200,
      timeoutMs: 45000,
      sessionId: 'repicobrew-search-planner',
    });
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = match ? (JSON.parse(match[0]) as { query?: unknown }) : null;
    const query = typeof parsed?.query === 'string' ? parsed.query.trim() : '';
    return query ? query.slice(0, 120) : null;
  } catch {
    return null;
  }
}

export async function gatherReferences(provider: ResolvedProvider, text: string): Promise<GatheredReferences> {
  const references = await fetchReferences(text);
  if (references.some((ref) => 'text' in ref)) {
    return { references, searchQuery: null, results: [] };
  }

  const searchQuery = await planSearchQuery(provider, text);
  const results = searchQuery ? await searchWeb(searchQuery, 6) : null;
  if (!searchQuery || !results || results.length === 0) {
    return { references, searchQuery, results: [] };
  }

  const pages = (await fetchUrls(results.slice(0, 4).map((r) => r.url)))
    .filter((ref): ref is Extract<FetchedReference, { text: string }> => 'text' in ref)
    .slice(0, PAGES_TO_READ);
  return { references: [...references, ...pages], searchQuery, results };
}

// Appended to the request so the model works from the fetched text and can't pretend to have seen a
// page it couldn't read.
export function referenceBlock({ references, searchQuery, results }: GatheredReferences): string {
  const parts: string[] = [];
  references.forEach((ref, i) => {
    parts.push(
      'text' in ref
        ? `[${i + 1}] ${ref.url}\n${ref.text}`
        : `[${i + 1}] ${ref.url}\n(COULD NOT BE READ: ${ref.error}. Do not claim to have used this page.)`,
    );
  });
  const searchBit =
    results.length > 0
      ? `\n\nWeb search results for "${searchQuery}":\n${results
          .map((r, i) => `${i + 1}. ${r.title} — ${r.url}\n   ${r.description}`)
          .join('\n')}`
      : '';
  if (parts.length === 0 && !searchBit) {
    return '';
  }
  return `\n\nReference material (fetched by the app — treat it as the source of truth and take quantities from it rather than guessing; if it doesn't contain what you need, say so):\n${parts.join(
    '\n\n',
  )}${searchBit}`;
}

// Links the server can vouch for: pages it actually read, and the search results it actually got.
export function sourceLinesFor({ references, results }: GatheredReferences): string[] {
  const lines: string[] = [];
  const read = new Set<string>();
  for (const ref of references) {
    if ('text' in ref) {
      read.add(ref.url);
      lines.push(`Read: [${ref.url}](${ref.url})`);
    } else {
      lines.push(`Could not read ${ref.url} (${ref.error}) — not used`);
    }
  }
  for (const r of results) {
    if (!read.has(r.url) && lines.length < 7) {
      lines.push(`Found: [${r.title.replace(/[[\]]/g, '')}](${r.url})`);
    }
  }
  return lines;
}
