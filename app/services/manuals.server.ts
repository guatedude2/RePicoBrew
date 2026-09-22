import fs from 'fs/promises';
import path from 'path';
import { manualSourceUrl, type Manual } from '~/utils/device-manuals';

// The official PicoBrew manuals, bundled straight into the repo (public/manuals/<slug>.pdf) instead of
// fetched at runtime: PicoBrew's servers are winding down, and this device's internet is unreliable
// enough (see the Wi-Fi troubleshooting in this repo's history) that a runtime download was never a
// safe primary path. manualSourceUrl is kept only as a last-resort fallback if a PDF is ever missing.

const MANUALS_DIR = path.join(process.cwd(), 'public', 'manuals');

const bundledPath = (manual: Manual) => path.join(MANUALS_DIR, `${manual.slug}.pdf`);

// The PDF's bytes, or null if it isn't bundled (caller falls back to the source link).
export async function readManual(manual: Manual): Promise<Buffer | null> {
  try {
    return await fs.readFile(bundledPath(manual));
  } catch {
    console.error(`[manuals] ${manual.slug}.pdf is not bundled; falling back to ${manualSourceUrl(manual)}`);
    return null;
  }
}
