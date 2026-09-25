import type { ActionFunctionArgs } from 'react-router';
import { data } from 'react-router';
import { requireUser } from '~/services/auth.server';
import { estimateGravityTargets, type GravityEstimateInput } from '~/services/ai-gravity-estimator.server';

// POST /api/ai-gravity
// Body: { name, style?, abv?, ibu?, notes?, batchLiters, yeastName?, yeastAmountGrams?,
//         grains: [{ name, ounces }], hops: [{ name, ounces }] }
// Returns { success: true, og, fg, attenuation, explanation } — estimates for the PicoPack editor's OG/FG/attenuation
// fields. Nothing is saved here; the editor fills the form and the user reviews it.
export const action = async ({ request }: ActionFunctionArgs) => {
  await requireUser(request);
  if (request.method !== 'POST') {
    return data({ error: 'Method not allowed' }, { status: 405 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return data({ error: 'Invalid request body' }, { status: 400 });
  }

  const rows = (value: unknown) =>
    (Array.isArray(value) ? value : [])
      .slice(0, 30)
      .map((row) => ({
        name: typeof row?.name === 'string' ? row.name.slice(0, 80) : '',
        ounces: Number(row?.ounces),
      }))
      .filter((row) => row.name && Number.isFinite(row.ounces) && row.ounces > 0);

  const input: GravityEstimateInput = {
    name: typeof body.name === 'string' ? body.name.slice(0, 120) : 'Recipe',
    style: typeof body.style === 'string' ? body.style : null,
    abv: Number.isFinite(Number(body.abv)) ? Number(body.abv) : null,
    ibu: Number.isFinite(Number(body.ibu)) ? Number(body.ibu) : null,
    notes: typeof body.notes === 'string' ? body.notes : null,
    batchLiters:
      Number.isFinite(Number(body.batchLiters)) && Number(body.batchLiters) > 0 ? Number(body.batchLiters) : 5,
    yeastName: typeof body.yeastName === 'string' ? body.yeastName.slice(0, 80) : null,
    yeastAmountGrams: Number.isFinite(Number(body.yeastAmountGrams)) ? Number(body.yeastAmountGrams) : null,
    grains: rows(body.grains),
    hops: rows(body.hops),
  };

  const result = await estimateGravityTargets(input);
  if (!result.success) {
    return data({ error: result.error }, { status: 422 });
  }
  return result;
};
