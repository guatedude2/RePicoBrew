import fs from 'fs/promises';
import path from 'path';
import { ALL_MANUALS, manualSourceUrl, type Manual } from '~/utils/device-manuals';

// Local cache of the official PicoBrew manuals. PicoBrew's servers are winding down, so a copy is kept on
// the device: a PDF is downloaded the first time it's opened (or by the background prefetch on the Pi) and
// served from disk after that. Only URLs from the fixed catalog are ever fetched, never user input.

const CACHE_DIR = process.env.MANUALS_DIR || path.join(process.cwd(), 'manuals-cache');
const MAX_BYTES = 40 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 120000;

const cachePath = (manual: Manual) => path.join(CACHE_DIR, `${manual.slug}.pdf`);
const inflight = new Map<string, Promise<boolean>>();

async function isCached(manual: Manual): Promise<boolean> {
  try {
    return (await fs.stat(cachePath(manual))).size > 0;
  } catch {
    return false;
  }
}

async function download(manual: Manual): Promise<boolean> {
  try {
    const response = await fetch(manualSourceUrl(manual), { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
    if (!response.ok) {
      return false;
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_BYTES || bytes.subarray(0, 4).toString() !== '%PDF') {
      return false;
    }
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const tmp = `${cachePath(manual)}.${process.pid}.tmp`;
    await fs.writeFile(tmp, bytes);
    await fs.rename(tmp, cachePath(manual));
    return true;
  } catch (error) {
    console.error(`[manuals] could not download ${manual.slug}:`, error instanceof Error ? error.message : error);
    return false;
  }
}

async function ensureCached(manual: Manual): Promise<boolean> {
  if (await isCached(manual)) {
    return true;
  }
  const pending = inflight.get(manual.slug) ?? download(manual).finally(() => inflight.delete(manual.slug));
  inflight.set(manual.slug, pending);
  return pending;
}

// The PDF's bytes, or null if it isn't cached and couldn't be downloaded (caller falls back to the source link).
export async function readManual(manual: Manual): Promise<Buffer | null> {
  if (!(await ensureCached(manual))) {
    return null;
  }
  return fs.readFile(cachePath(manual));
}

// Fetches every manual not already on disk, one at a time, shortly after start-up — so they're there when
// the network isn't. Runs once per process.
export function schedulePrefetch(delayMs = 45000) {
  const globalState = globalThis as { __manualsPrefetchScheduled?: boolean };
  if (globalState.__manualsPrefetchScheduled) {
    return;
  }
  globalState.__manualsPrefetchScheduled = true;
  setTimeout(async () => {
    for (const manual of ALL_MANUALS) {
      await ensureCached(manual);
    }
  }, delayMs).unref();
}
