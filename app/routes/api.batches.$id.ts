import type { ActionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { BatchRepository } from '~/repositories/batch.server';
import { BatchPhase } from '~/types';

/**
 * POST /api/batches/:id
 * Body: { intent: 'startFermentation' | 'startBottling' | 'startCarbonation' | 'extendCarbonation' | 'finishCarbonation' | 'endBatch' | 'archive', ... }
 */
export async function action({ request, params }: ActionArgs) {
  const id = Number(params.id);
  const body = await request.json();
  const { intent } = body;

  switch (intent) {
    case 'startFermentation': {
      const batch = await BatchRepository.advancePhase(id, BatchPhase.COOLING, BatchPhase.FERMENTING);
      return json({ success: true, batch });
    }
    case 'startBottling': {
      const batch = await BatchRepository.advancePhase(id, BatchPhase.FERMENTING, BatchPhase.BOTTLING);
      return json({ success: true, batch });
    }
    case 'startCarbonation': {
      const { method, duration, unit } = body;
      if (!method || duration == null || !unit) {
        return json({ error: 'Missing required fields: method, duration, unit' }, { status: 400 });
      }
      // Most batches arrive here from Bottling; a batch already sitting in Carbonating (e.g. older
      // data from before Bottling existed) just gets its carb fields set, unchanged.
      await BatchRepository.advancePhase(id, BatchPhase.BOTTLING, BatchPhase.CARBONATING);
      const batch = await BatchRepository.startCarbonation(id, method, Number(duration), unit);
      return json({ success: true, batch });
    }
    case 'extendCarbonation': {
      const { extendMinutes } = body;
      const batch = await BatchRepository.extendCarbonation(id, Number(extendMinutes) || 0);
      return json({ success: true, batch });
    }
    case 'finishCarbonation': {
      const batch = await BatchRepository.finishCarbonation(id);
      return json({ success: true, batch });
    }
    case 'endBatch': {
      const batch = await BatchRepository.endBatch(id);
      return json({ success: true, batch });
    }
    case 'archive': {
      const batch = await BatchRepository.archiveBatch(id);
      return json({ success: true, batch });
    }
    default:
      return json({ error: 'Unknown intent' }, { status: 400 });
  }
}
