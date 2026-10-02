import prisma from '~/services/prisma.server';

// Fermentation readings (SessionLog type 1) arrive every few seconds, so a long ferment reaches 100k+ raw rows.
// Charts and AI summaries read these per-minute, 15-minute and hourly rollups instead; the raw rows are kept as-is.
// Table names below are fixed constants, never user input.
export const ROLLUPS = {
  minute: { table: 'SessionLogMinute', ms: 60_000 },
  quarterHour: { table: 'SessionLogQuarterHour', ms: 900_000 },
  hour: { table: 'SessionLogHour', ms: 3_600_000 },
} as const;
export type RollupResolution = keyof typeof ROLLUPS;

// The finest resolution that keeps a window to a few hundred points: up to 12 hours by the minute (720), up to 4 days
// by the quarter hour (384), hourly beyond that.
export function resolutionForSpan(spanMs: number): RollupResolution {
  if (spanMs <= 12 * ROLLUPS.hour.ms) {
    return 'minute';
  }
  return spanMs <= 96 * ROLLUPS.hour.ms ? 'quarterHour' : 'hour';
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// Adds one reading to all three rollups. `data.time` (ms) is when it was taken, which is what charts plot.
export async function addReadingToRollups(sessionId: number, data: Record<string, unknown>, fallbackTime: Date) {
  const t = num(data.time) ?? fallbackTime.getTime();
  const temp = num(data.temp);
  const gravity = num(data.gravity) !== null && (data.gravity as number) > 0 ? (data.gravity as number) : null;
  const pressure = num(data.pressure);
  await prisma.$transaction(
    Object.values(ROLLUPS).map(({ table, ms }) =>
      prisma.$executeRawUnsafe(
        `INSERT INTO "${table}" ("sessionId", "bucket", "lastTime", "n", "tempSum", "tempN", "tempMin", "tempMax",
           "gravitySum", "gravityN", "gravityMin", "gravityMax", "pressureSum", "pressureN")
         VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT ("sessionId", "bucket") DO UPDATE SET
           "lastTime" = max("lastTime", excluded."lastTime"),
           "n" = "n" + 1,
           "tempSum" = "tempSum" + excluded."tempSum",
           "tempN" = "tempN" + excluded."tempN",
           "tempMin" = min(coalesce("tempMin", excluded."tempMin"), coalesce(excluded."tempMin", "tempMin")),
           "tempMax" = max(coalesce("tempMax", excluded."tempMax"), coalesce(excluded."tempMax", "tempMax")),
           "gravitySum" = "gravitySum" + excluded."gravitySum",
           "gravityN" = "gravityN" + excluded."gravityN",
           "gravityMin" = min(coalesce("gravityMin", excluded."gravityMin"), coalesce(excluded."gravityMin", "gravityMin")),
           "gravityMax" = max(coalesce("gravityMax", excluded."gravityMax"), coalesce(excluded."gravityMax", "gravityMax")),
           "pressureSum" = "pressureSum" + excluded."pressureSum",
           "pressureN" = "pressureN" + excluded."pressureN"`,
        sessionId,
        Math.floor(t / ms) * ms,
        t,
        temp ?? 0,
        temp === null ? 0 : 1,
        temp,
        temp,
        gravity ?? 0,
        gravity === null ? 0 : 1,
        gravity,
        gravity,
        pressure ?? 0,
        pressure === null ? 0 : 1,
      ),
    ),
  );
}

type RollupRow = {
  bucket: bigint | number;
  lastTime: bigint | number;
  tempSum: number;
  tempN: number;
  gravitySum: number;
  gravityN: number;
  pressureSum: number;
  pressureN: number;
};

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

// A session's fermentation readings, averaged per bucket, shaped like SessionLog rows so existing chart code reads
// them unchanged. Returns null when the session has no rollups (e.g. a brew session), so callers can fall back to
// the raw table. Without `resolution`, the finest one that suits the requested window (or the whole session) is used.
export async function listRolledUpReadings(
  sessionId: number,
  options: { from?: number; to?: number; resolution?: RollupResolution } = {},
) {
  const [extent] = await prisma.$queryRawUnsafe<Array<{ first: bigint | null; last: bigint | null }>>(
    `SELECT MIN("bucket") AS first, MAX("lastTime") AS last FROM "SessionLogHour" WHERE "sessionId" = ?`,
    sessionId,
  );
  if (extent?.first == null || extent.last == null) {
    return null;
  }
  const from = options.from ?? Number(extent.first);
  const to = options.to ?? Number(extent.last);
  const resolution = options.resolution ?? resolutionForSpan(to - from);
  const { table, ms } = ROLLUPS[resolution];
  const rows = await prisma.$queryRawUnsafe<RollupRow[]>(
    `SELECT "bucket", "lastTime", "tempSum", "tempN", "gravitySum", "gravityN", "pressureSum", "pressureN"
     FROM "${table}" WHERE "sessionId" = ? AND "bucket" >= ? AND "bucket" <= ? ORDER BY "bucket"`,
    sessionId,
    Math.floor(from / ms) * ms,
    to,
  );
  return rows.map((row) => {
    const bucket = Number(row.bucket);
    // The middle of the bucket, or its newest reading for the bucket still filling up.
    const time = Math.min(bucket + ms / 2, Number(row.lastTime));
    const data: Record<string, number> = { time };
    if (row.tempN > 0) {
      data.temp = round(row.tempSum / row.tempN, 1);
    }
    if (row.gravityN > 0) {
      data.gravity = round(row.gravitySum / row.gravityN, 4);
    }
    if (row.pressureN > 0) {
      data.pressure = round(row.pressureSum / row.pressureN, 2);
    }
    return { id: bucket, sessionId, type: 1, time: new Date(time), data: JSON.stringify(data) };
  });
}

export async function deleteRollupsForSessions(sessionIds: number[]) {
  if (sessionIds.length === 0) {
    return;
  }
  const placeholders = sessionIds.map(() => '?').join(', ');
  await prisma.$transaction(
    Object.values(ROLLUPS).map(({ table }) =>
      prisma.$executeRawUnsafe(`DELETE FROM "${table}" WHERE "sessionId" IN (${placeholders})`, ...sessionIds),
    ),
  );
}
