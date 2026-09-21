import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { readManual } from '~/services/manuals.server';
import { findManual, manualSourceUrl } from '~/utils/device-manuals';

/**
 * GET /manuals/:slug
 *
 * An official PicoBrew manual (see app/utils/device-manuals.ts), served from the device's local copy;
 * if it isn't cached yet and the download fails, sends the browser to PicoBrew's own copy instead.
 */
export const loader = async ({ params }: LoaderFunctionArgs) => {
  const manual = findManual(params.slug ?? '');
  if (!manual) {
    throw new Response('Manual not found', { status: 404 });
  }

  const bytes = await readManual(manual);
  if (!bytes) {
    return redirect(manualSourceUrl(manual));
  }
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${manual.slug}.pdf"`,
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
