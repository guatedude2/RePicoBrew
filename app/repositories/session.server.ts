import { lttbIndices } from '~/utils/lttb';
import prisma from '~/services/prisma.server';
import { SessionState, SessionType } from '~/types';
import { QUEUE_EXPIRY_MS, QUEUED_STATUS_TEXT } from '~/utils/queued-brew';

export type SessionLogData = Record<string, unknown>;

type SampleOptions = { from?: number; to?: number; max?: number };
type SampledRows = Array<{ id: number; sessionId: number; type: number; time: Date; data: string }>;

// Thinning a long session means reading and parsing every row, so the result is kept in memory (this app runs as one
// Node process, so a Redis-style external cache would add a service for no gain). Entries expire after a minute — a
// running session's chart also gets live points over SSE — and the least recently used are evicted.
const SAMPLED_TTL_MS = 60_000;
const SAMPLED_CACHE_MAX = 200;
const MAX_LTTB_INPUT = 20_000;
const sampledCache = new Map<string, { rows: SampledRows; expires: number }>();

export class SessionRepository {
  public static async createSession(
    uid: string,
    type: SessionType,
    deviceId: number,
    recipeId?: number,
    timeRemaining?: number,
    statusText = 'Ready to Brew',
  ) {
    return await prisma.session.create({
      data: {
        uid,
        type,
        deviceId,
        recipeId,
        state: SessionState.READY,
        statusText,
        timeRemaining,
      },
    });
  }

  // The brew (if any) queued from the app for this device and not yet picked up on it — see
  // app/utils/queued-brew.ts. Expired ones don't count.
  public static async findQueuedBrew(deviceId: number) {
    return await prisma.session.findFirst({
      where: {
        deviceId,
        type: SessionType.BREWING,
        state: SessionState.READY,
        statusText: QUEUED_STATUS_TEXT,
        createdAt: { gt: new Date(Date.now() - QUEUE_EXPIRY_MS) },
      },
      orderBy: { createdAt: 'desc' },
      include: { recipe: true },
    });
  }

  public static async getSession(uid: string) {
    return await prisma.session.findUnique({ where: { uid }, include: { device: true, recipe: true } });
  }

  public static async getLastActiveSessionByDeviceId(deviceId: number) {
    return await prisma.session.findFirst({
      where: { deviceId },
      orderBy: { updatedAt: 'desc' },
      include: { device: true, recipe: true },
    });
  }

  public static async listSessions(filters?: { deviceId?: number; state?: SessionState; limit?: number }) {
    return await prisma.session.findMany({
      where: {
        ...(filters?.deviceId && { deviceId: filters.deviceId }),
        ...(filters?.state !== undefined && { state: filters.state }),
      },
      orderBy: { updatedAt: 'desc' },
      take: filters?.limit || 100,
      include: {
        device: true,
        recipe: true,
        _count: {
          select: { logs: true },
        },
      },
    });
  }

  public static async listActiveSessions() {
    return await prisma.session.findMany({
      where: {
        state: { in: [SessionState.READY, SessionState.IN_PROGRESS] },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        device: true,
        recipe: {
          include: {
            steps: true,
          },
        },
      },
    });
  }

  public static async updateSessionState(
    id: number,
    type: SessionType,
    state: SessionState,
    statusText?: string,
    timeRemaining?: number,
  ) {
    return await prisma.session.update({ where: { id }, data: { type, state, statusText, timeRemaining } });
  }

  public static async cancelSession(id: number) {
    return await prisma.session.update({
      where: { id },
      data: {
        state: SessionState.CANCELED,
        statusText: 'Canceled',
      },
    });
  }

  public static async createSessionLogEntry(sessionId: number, data: SessionLogData, type = 0) {
    return await prisma.sessionLog.create({
      data: { sessionId, type, data: JSON.stringify(data) },
    });
  }

  public static async getSessionById(id: number) {
    return await prisma.session.findUnique({
      where: { id },
      include: { device: true, recipe: true },
    });
  }

  public static async startSession(id: number) {
    return await prisma.session.update({
      where: { id },
      data: {
        state: SessionState.IN_PROGRESS,
        statusText: 'Fermenting',
      },
    });
  }

  public static async completeSession(id: number) {
    return await prisma.session.update({
      where: { id },
      data: {
        state: SessionState.COMPLETED,
        statusText: 'Completed',
      },
    });
  }

  public static async listSessionLogs(sessionId: number) {
    return await prisma.sessionLog.findMany({
      where: { sessionId },
      orderBy: { time: 'asc' },
    });
  }

  public static async getLatestSessionLog(sessionId: number) {
    return await prisma.sessionLog.findFirst({ where: { sessionId }, orderBy: { time: 'desc' } });
  }

  // A session's log history thinned to roughly `max` rows (all of them when there are fewer), for charting.
  // SQL first cheaply cuts it to a few times `max` (evenly spaced, plus every brew-step change and the newest
  // row); then Largest-Triangle-Three-Buckets keeps the points that best preserve each series' shape, so short
  // spikes survive. `from`/`to` (ms epoch) restrict it to a window, which is how a zoomed-in chart gets detail
  // for just the part it is showing.
  public static async listSessionLogsSampled(sessionId: number, options: SampleOptions = {}) {
    const key = `${sessionId}:${options.from ?? ''}:${options.to ?? ''}:${options.max ?? 600}`;
    const hit = sampledCache.get(key);
    if (hit && hit.expires > Date.now()) {
      sampledCache.delete(key);
      sampledCache.set(key, hit); // refresh LRU position
      return hit.rows;
    }
    const rows = await this.computeSessionLogsSampled(sessionId, options);
    sampledCache.set(key, { rows, expires: Date.now() + SAMPLED_TTL_MS });
    while (sampledCache.size > SAMPLED_CACHE_MAX) {
      sampledCache.delete(sampledCache.keys().next().value as string);
    }
    return rows;
  }

  private static async computeSessionLogsSampled(sessionId: number, { from, to, max = 600 }: SampleOptions) {
    // `time` is an integer (ms) in some databases and ISO text in others, depending on how the row was written, and
    // SQLite never matches a number against text — so bind bounds of whichever kind this session's rows use.
    const [sample] = await prisma.$queryRaw<Array<{ kind: string }>>`
      SELECT typeof(time) AS kind FROM SessionLog WHERE sessionId = ${sessionId} LIMIT 1`;
    const isText = sample?.kind === 'text';
    const iso = (ms: number) => new Date(ms).toISOString().replace('Z', '+00:00');
    const fromMs = isText ? (from === undefined ? '0000-01-01' : iso(from)) : from ?? 0;
    const toMs = isText ? (to === undefined ? '9999-12-31' : iso(to)) : to ?? Number.MAX_SAFE_INTEGER;
    const [{ total }] = await prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*) AS total FROM SessionLog WHERE sessionId = ${sessionId} AND time >= ${fromMs} AND time <= ${toMs}`;
    // LTTB runs over (nearly) every row; only pathological sizes get a cheap even pre-thin first.
    const stride = Math.max(1, Math.floor(Number(total) / MAX_LTTB_INPUT));
    const rows = await prisma.$queryRaw<
      Array<{ id: number; sessionId: number; type: number; time: Date; data: string }>
    >`
      SELECT id, sessionId, type, time, data FROM (
        SELECT *,
          ROW_NUMBER() OVER (ORDER BY time) AS rn,
          COUNT(*) OVER () AS cnt,
          LAG(json_extract(data, '$.step')) OVER (ORDER BY time) AS prevStep
        FROM SessionLog
        WHERE sessionId = ${sessionId} AND time >= ${fromMs} AND time <= ${toMs}
      )
      WHERE ${stride} = 1 OR rn % ${stride} = 1 OR rn = cnt OR json_extract(data, '$.step') IS NOT prevStep
      ORDER BY time`;
    if (rows.length <= max) {
      return rows;
    }

    const parsed = rows.map((row) => {
      try {
        return JSON.parse(row.data) as Record<string, unknown>;
      } catch {
        return {};
      }
    });
    const xs = rows.map((row) => new Date(row.time).getTime());
    const keep = new Set<number>([0, rows.length - 1]);
    parsed.forEach((d, i) => {
      if (i > 0 && d.step !== parsed[i - 1].step) {
        keep.add(i);
      }
    });
    for (const key of ['wort', 'therm', 'temp', 'gravity']) {
      const idx = parsed.map((_, i) => i).filter((i) => typeof parsed[i][key] === 'number');
      if (idx.length === 0) {
        continue;
      }
      lttbIndices(
        idx.map((i) => xs[i]),
        idx.map((i) => parsed[i][key] as number),
        max,
      ).forEach((k) => keep.add(idx[k]));
    }
    return rows.filter((_, i) => keep.has(i));
  }
}
