import fs from 'fs/promises';
import path from 'path';
import { manualSourceUrl, type Manual } from '~/utils/device-manuals';

// The official PicoBrew manuals, bundled straight into the repo (public/manuals/<slug>.pdf) and served
// from disk only — never fetched over the network. PicoBrew's servers are winding down, and this
// device's internet is unreliable enough (see the Wi-Fi troubleshooting in this repo's history) that a
// runtime dependency on picobrewcontent.blob.core.windows.net was never acceptable.

const MANUALS_DIR = path.join(process.cwd(), 'public', 'manuals');

const bundledPath = (manual: Manual) => path.join(MANUALS_DIR, `${manual.slug}.pdf`);

// The PDF's bytes, or null if it was never bundled (caller 404s — see manualSourceUrl for where to
// re-download it from, if PicoBrew's site is still up).
export async function readManual(manual: Manual): Promise<Buffer | null> {
  try {
    return await fs.readFile(bundledPath(manual));
  } catch {
    console.error(`[manuals] ${manual.slug}.pdf is not bundled (original source: ${manualSourceUrl(manual)})`);
    return null;
  }
}
