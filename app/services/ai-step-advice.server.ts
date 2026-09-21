import { AiSettingsRepository } from '~/repositories/ai-settings.server';
import { analyzeBatch } from '~/services/ai-advisor.server';

// Fresh AI advice each time a brew moves to a new step. The Pico's log often changes step twice within a couple
// of seconds (Heating -> Dough In), so each batch's request is held for a few seconds and only the latest step
// is analysed; if an analysis is still running when the next is due, that one waits its turn.
const SETTLE_MS = 5000;

const timers = new Map<number, NodeJS.Timeout>();
const running = new Set<number>();

function schedule(batchId: number) {
  clearTimeout(timers.get(batchId));
  timers.set(
    batchId,
    setTimeout(async () => {
      timers.delete(batchId);
      if (running.has(batchId)) {
        schedule(batchId);
        return;
      }
      running.add(batchId);
      try {
        await analyzeBatch(batchId, 'step');
      } catch (error) {
        console.error(`[ai-step-advice] batch ${batchId} failed`, error);
      } finally {
        running.delete(batchId);
      }
    }, SETTLE_MS),
  );
}

export async function adviseOnStepChange(batchId: number) {
  if (!(await AiSettingsRepository.hasActiveKey())) {
    return;
  }
  schedule(batchId);
}
