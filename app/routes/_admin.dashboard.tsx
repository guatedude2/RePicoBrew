import type { LoaderFunctionArgs } from 'react-router';
import { BatchRepository } from '~/repositories/batch.server';
import { BatchPhase } from '~/types';
import { batchNeedsAttention, batchOverallProgress } from '~/utils/batch-phase';

export const meta = () => [{ title: 'Dashboard | RePicoBrew' }, { name: 'description', content: 'Live brew tracking' }];

export const loader = async (_args: LoaderFunctionArgs) => {
  const [ongoing, recent] = await Promise.all([BatchRepository.listOngoing(), BatchRepository.listRecentCompleted(5)]);

  const ongoingBrews = ongoing.map((batch) => ({
    id: batch.id,
    name: batch.name,
    phase: batch.phase,
    // Same formula Session Detail uses for its header stat, so the two pages agree on a batch's progress.
    progress: batchOverallProgress(batch),
    needsAttention: batchNeedsAttention(batch),
    session: batch.sessions[0]
      ? {
          id: batch.sessions[0].id,
          statusText: batch.sessions[0].statusText,
          timeRemaining: batch.sessions[0].timeRemaining,
          device: batch.sessions[0].device?.name ?? null,
        }
      : null,
    carbMethod: batch.carbMethod,
  }));

  const fermentingCount = ongoing.filter((b) => b.phase === BatchPhase.FERMENTING).length;

  return { ongoingBrews, fermentingCount, recentBatches: recent };
};

export { Dashboard as default } from '~/pages/Dashboard';
