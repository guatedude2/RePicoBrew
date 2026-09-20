import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

// Fetches web pages a user links to in an AI recipe request, so the model can work from the real
// recipe text instead of recalling (and possibly inventing) it. The URL comes from user input and
// this server sits on a home network next to other devices, so anything resolving to a private,
// loopback or link-local address is refused.

export type FetchedReference = { url: string; text: string } | { url: string; error: string };

const MAX_URLS = 2;
const MAX_BYTES = 750_000;
const MAX_TEXT_CHARS = 8000;
const FETCH_TIMEOUT_MS = 8000;

const URL_PATTERN = /https?:\/\/[^\s<>"')]+/gi;

export function extractUrls(text: string): string[] {
  const found = (text.match(URL_PATTERN) ?? []).map((u) => u.replace(/[.,;:!?]+$/, ''));
  return [...new Set(found)].slice(0, MAX_URLS);
}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 6) {
    const lower = address.toLowerCase();
    if (lower === '::1' || lower.startsWith('fe80') || lower.startsWith('fc') || lower.startsWith('fd')) {
      return true;
    }
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }
  const [a, b] = address.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

async function fetchOne(rawUrl: string): Promise<FetchedReference> {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { url: rawUrl, error: 'only http(s) links can be read' };
    }
    const addresses = isIP(url.hostname) ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true });
    if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
      return { url: rawUrl, error: 'that address is not reachable from here' };
    }

    // redirect: 'manual' so a public URL can't bounce the request to an internal address.
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'RePicoBrew/1.0 (recipe reference fetch)', Accept: 'text/html,text/plain' },
    });
    if (response.status >= 300 && response.status < 400) {
      return { url: rawUrl, error: 'the link redirects; paste the final address or the recipe text instead' };
    }
    if (!response.ok) {
      return { url: rawUrl, error: `the site answered ${response.status}` };
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!/text\/(html|plain)/i.test(contentType)) {
      return { url: rawUrl, error: 'the link is not a web page' };
    }
    const body = (await response.text()).slice(0, MAX_BYTES);
    const text = (/html/i.test(contentType) ? htmlToText(body) : body.trim()).slice(0, MAX_TEXT_CHARS);
    if (text.length < 40) {
      return { url: rawUrl, error: 'no readable text found on the page' };
    }
    return { url: rawUrl, text };
  } catch {
    return { url: rawUrl, error: 'the page could not be loaded' };
  }
}

export async function fetchReferences(userText: string): Promise<FetchedReference[]> {
  return Promise.all(extractUrls(userText).map(fetchOne));
}

export async function fetchUrls(urls: string[]): Promise<FetchedReference[]> {
  return Promise.all(urls.map(fetchOne));
}
