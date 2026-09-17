/* eslint-disable no-var */
import { AiAdviceRepository } from '~/repositories/ai-advice.server';
import { AiSettingsRepository } from '~/repositories/ai-settings.server';
import { BatchRepository } from '~/repositories/batch.server';
import { analyzeBatch } from '~/services/ai-advisor.server';
import { BatchPhase } from '~/types';

const TICK_MS = 5 * 60 * 1000;

// How long a batch can go without a fresh check-in before the next tick considers it "due" —
// this (plus the fact the tick itself is a no-op DB read when no API key is set) is the main
// cost-control lever: brewing is short and fast-moving so it's checked often, fermentation is
// slow so infrequent checks lose nothing.
const MIN_INTERVAL_MS: Record<string, number> = {
  [BatchPhase.BREWING]: 30 * 60 * 1000,
  [BatchPhase.FERMENTING]: 8 * 60 * 60 * 1000,
};

async function runTick() {
  if (!(await AiSettingsRepository.hasActiveKey())) {
    return;
  }

  const batches = await BatchRepository.listActiveForAi();
  for (const batch of batches) {
    try {
      const minInterval = MIN_INTERVAL_MS[batch.phase];
      if (!minInterval) {
        continue;
      }
      const latest = await AiAdviceRepository.getLatestForBatchPhase(batch.id, batch.phase);
      const due = !latest || Date.now() - latest.createdAt.getTime() >= minInterval;
      if (due) {
        await analyzeBatch(batch.id, 'scheduled');
      }
    } catch (error) {
      console.error(`[ai-scheduler] tick failed for batch ${batch.id}`, error);
    }
  }
}

declare global {
  var __aiSchedulerStarted: boolean | undefined;
}

// Side-effect module: importing this once (from app/routes/_admin.tsx) starts the interval.
// Guarded the same way app/services/pubsub.server.ts guards its singleton, so Vite's dev-mode
// module reloads don't stack up duplicate intervals.
if (!global.__aiSchedulerStarted) {
  global.__aiSchedulerStarted = true;
  setInterval(() => {
    void runTick();
  }, TICK_MS);
}
