// Cold crashing: after fermentation the fermenter sits in the fridge for 1-3 days so the yeast drops out of
// suspension, which clears the beer and makes racking easier (PicoBrew's Pico manuals: "Allow the beer to sit for
// 1-3 days at colder temperatures before racking").

export const COLD_CRASH_TEMP = { min: 33, max: 40 };
export const COLD_CRASH_DEFAULT_DAYS = 2;
export const COLD_CRASH_MAX_DAYS = 7;

const DAY_MS = 86_400_000;

export function coldCrashWindow(batch: {
  coldCrashStartedAt?: Date | string | null;
  coldCrashDays?: number | null;
}): { start: number; end: number; days: number } | null {
  if (!batch.coldCrashStartedAt || !batch.coldCrashDays) {
    return null;
  }
  const start = new Date(batch.coldCrashStartedAt).getTime();
  return { start, end: start + batch.coldCrashDays * DAY_MS, days: batch.coldCrashDays };
}
