import type { LoaderFunctionArgs } from 'react-router';
import { readManual } from '~/services/manuals.server';
import { findManual } from '~/utils/device-manuals';

/**
 * GET /manuals/:slug
 *
 * An official PicoBrew manual (see app/utils/device-manuals.ts), bundled into the repo and served
 * straight from disk — never fetched from PicoBrew's own site.
 */
export const loader = async ({ params }: LoaderFunctionArgs) => {
  const manual = findManual(params.slug ?? '');
  if (!manual) {
    throw new Response('Manual not found', { status: 404 });
  }

  const bytes = await readManual(manual);
  if (!bytes) {
    throw new Response('Manual not bundled', { status: 404 });
  }
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${manual.slug}.pdf"`,
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
