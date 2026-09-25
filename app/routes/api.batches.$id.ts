import type { ActionFunctionArgs } from 'react-router';
import { data } from 'react-router';
import { BatchRepository } from '~/repositories/batch.server';
import { analyzeBatch } from '~/services/ai-advisor.server';
import { BatchPhase } from '~/types';
import { requireWriter } from '~/services/auth.server';

/**
 * POST /api/batches/:id
 * Body: { intent: 'startFermentation' | 'startBottling' | 'startCarbonation' | 'extendCarbonation' | 'finishCarbonation' | 'endBatch' | 'archive' | 'requestAiAdvice' | 'extendFermentation', ... }
 */
export async function action({ request, params }: ActionFunctionArgs) {
  await requireWriter(request);
  const id = Number(params.id);
  const body = await request.json();
  const { intent } = body;

  switch (intent) {
    case 'startFermentation': {
      const batch = await BatchRepository.advancePhase(id, BatchPhase.COOLING, BatchPhase.FERMENTING);
      return { success: true, batch };
    }
    case 'startBottling': {
      const batch = await BatchRepository.advancePhase(id, BatchPhase.FERMENTING, BatchPhase.BOTTLING);
      return { success: true, batch };
    }
    case 'startCarbonation': {
      const { method, duration, unit } = body;
      if (!method || duration == null || !unit) {
        return data({ error: 'Missing required fields: method, duration, unit' }, { status: 400 });
      }
      // Most batches arrive here from Bottling; a batch already sitting in Carbonating (e.g. older
      // data from before Bottling existed) just gets its carb fields set, unchanged.
      await BatchRepository.advancePhase(id, BatchPhase.BOTTLING, BatchPhase.CARBONATING);
      const batch = await BatchRepository.startCarbonation(id, method, Number(duration), unit);
      return { success: true, batch };
    }
    case 'extendCarbonation': {
      const { extendMinutes } = body;
      const batch = await BatchRepository.extendCarbonation(id, Number(extendMinutes) || 0);
      return { success: true, batch };
    }
    case 'finishCarbonation': {
      const batch = await BatchRepository.finishCarbonation(id);
      return { success: true, batch };
    }
    case 'endBatch': {
      const batch = await BatchRepository.endBatch(id);
      return { success: true, batch };
    }
    case 'archive': {
      const batch = await BatchRepository.archiveBatch(id);
      return { success: true, batch };
    }
    case 'extendFermentation': {
      const days = Number(body.days);
      if (!Number.isInteger(days) || days < 1 || days > 60) {
        return data({ error: 'Enter a whole number of days between 1 and 60.' }, { status: 400 });
      }
      try {
        const batch = await BatchRepository.extendFermentation(id, days);
        return { success: true, batch };
      } catch (error) {
        return data(
          { error: error instanceof Error ? error.message : 'Could not extend fermentation.' },
          { status: 400 },
        );
      }
    }
    case 'requestAiAdvice': {
      const result = await analyzeBatch(id, 'manual');
      if (!result.success) {
        return data({ error: result.error }, { status: 400 });
      }
      return { success: true, advice: result.advice };
    }
    default:
      return data({ error: 'Unknown intent' }, { status: 400 });
  }
}
