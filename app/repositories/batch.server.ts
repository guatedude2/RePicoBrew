import prisma from '~/services/prisma.server';
import { BatchPhase, SessionState, SessionType } from '~/types';

export class BatchRepository {
  public static async createBatch(
    name: string,
    recipeId?: number | null,
    options?: { fermentDeviceId?: number | null; carbMethod?: string; carbUnit?: string; carbDuration?: number },
  ) {
    return await prisma.batch.create({
      data: {
        name,
        recipeId: recipeId ?? undefined,
        fermentDeviceId: options?.fermentDeviceId ?? undefined,
        carbMethod: options?.carbMethod,
        carbUnit: options?.carbUnit,
        carbDuration: options?.carbDuration,
      },
    });
  }

  public static async getBatch(id: number) {
    return await prisma.batch.findUnique({
      where: { id },
      include: {
        recipe: { include: { steps: true } },
        sessions: {
          orderBy: { createdAt: 'asc' },
          include: { device: true, _count: { select: { logs: true } } },
        },
      },
    });
  }

  // A session's "detail" page is really its batch's detail page — resolve one from the other.
  public static async getBatchBySessionId(sessionId: number) {
    const session = await prisma.session.findUnique({ where: { id: sessionId }, select: { batchId: true } });
    if (!session?.batchId) {
      return null;
    }
    return await this.getBatch(session.batchId);
  }

  // Self-heals sessions created before batches existed (or any orphaned session) by minting one
  // on first view, with phase derived from the session's own state so it lands in the right spot.
  public static async getOrCreateBatchForSession(sessionId: number) {
    const existing = await this.getBatchBySessionId(sessionId);
    if (existing) {
      return existing;
    }

    const session = await prisma.session.findUnique({ where: { id: sessionId }, include: { recipe: true } });
    if (!session) {
      return null;
    }

    // A completed Brewing/manual-brew session only means the brew itself finished — the batch
    // lands in Cooling to wait for the user to confirm the wort has cooled and fermentation has
    // actually started (see BatchRepository.advancePhase / the startFermentation intent).
    const isBrewingSession =
      session.type === SessionType.BREWING ||
      session.type === SessionType.MANUAL_BREW ||
      session.type === SessionType.COLD_BREW;
    const phase =
      session.state === SessionState.CANCELED
        ? BatchPhase.CANCELED
        : session.state === SessionState.COMPLETED
        ? isBrewingSession
          ? BatchPhase.COOLING
          : BatchPhase.COMPLETED
        : BatchPhase.BREWING;
    const batch = await prisma.batch.create({
      data: {
        name: session.recipe?.name ?? 'Custom Brew',
        recipeId: session.recipeId ?? undefined,
        phase,
        completedAt: phase === BatchPhase.COMPLETED ? session.updatedAt : undefined,
      },
    });
    await this.attachSession(batch.id, sessionId);
    return await this.getBatch(batch.id);
  }

  public static async listOngoing(limit = 10) {
    return await prisma.batch.findMany({
      where: {
        phase: {
          in: [
            BatchPhase.BREWING,
            BatchPhase.COOLING,
            BatchPhase.FERMENTING,
            BatchPhase.BOTTLING,
            BatchPhase.CARBONATING,
          ],
        },
        archived: false,
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        sessions: { orderBy: { createdAt: 'desc' }, take: 1, include: { device: true } },
        recipe: { include: { steps: true } },
      },
    });
  }

  public static async listRecentCompleted(limit = 5) {
    return await prisma.batch.findMany({
      where: { phase: { in: [BatchPhase.COMPLETED, BatchPhase.CANCELED] }, archived: false },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }

  public static async listPaginated(
    page: number,
    pageSize: number,
    sort: 'date' | 'recipe' | 'device' | 'status' = 'date',
    dir: 'asc' | 'desc' = 'desc',
  ) {
    const where = { archived: false };
    const include = {
      sessions: {
        orderBy: { createdAt: 'desc' as const },
        include: { device: true, _count: { select: { logs: true } } },
      },
      recipe: { select: { fermentDays: true } },
    };

    // Device isn't a direct Batch column (it comes from the most recent session's relation), so it
    // can't be sorted at the DB level with a simple orderBy — sort in memory instead. Fine at this
    // data scale; revisit with a denormalized column if this list ever gets large.
    if (sort === 'device') {
      const all = await prisma.batch.findMany({ where, include });
      const total = all.length;
      const sorted = [...all].sort((a, b) => {
        const an = a.sessions[0]?.device?.name ?? '';
        const bn = b.sessions[0]?.device?.name ?? '';
        return dir === 'asc' ? an.localeCompare(bn) : bn.localeCompare(an);
      });
      const skip = (page - 1) * pageSize;
      return { batches: sorted.slice(skip, skip + pageSize), total };
    }

    const orderByField = sort === 'recipe' ? 'name' : sort === 'status' ? 'phase' : 'updatedAt';
    const [batches, total] = await Promise.all([
      prisma.batch.findMany({
        where,
        orderBy: { [orderByField]: dir },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include,
      }),
      prisma.batch.count({ where }),
    ]);
    return { batches, total };
  }

  // Batches currently fermenting with no Tilt session linked yet — candidates to attach a new tracker to.
  public static async listAwaitingFermentationTracker() {
    const batches = await prisma.batch.findMany({
      where: { phase: BatchPhase.FERMENTING },
      include: { sessions: true },
      orderBy: { updatedAt: 'desc' },
    });
    return batches.filter((b) => !b.sessions.some((s: { type: number }) => s.type === 3));
  }

  public static async attachSession(batchId: number, sessionId: number) {
    return await prisma.session.update({ where: { id: sessionId }, data: { batchId } });
  }

  public static async setPhase(id: number, phase: BatchPhase) {
    return await prisma.batch.update({
      where: { id },
      data: { phase, completedAt: phase === BatchPhase.COMPLETED ? new Date() : undefined },
    });
  }

  // Moves a batch to the next phase only if it's still where the caller expects — avoids racing
  // two triggers (e.g. brew-complete firing twice) into skipping a phase.
  public static async advancePhase(id: number, from: BatchPhase, to: BatchPhase) {
    const batch = await prisma.batch.findUnique({ where: { id } });
    if (!batch || batch.phase !== from) {
      return batch;
    }
    return await this.setPhase(id, to);
  }

  public static async startCarbonation(id: number, method: string, duration: number, unit: string) {
    return await prisma.batch.update({
      where: { id },
      data: {
        carbMethod: method,
        carbDuration: duration,
        carbUnit: unit,
        carbStartedAt: new Date(),
        carbStatus: 'counting',
      },
    });
  }

  public static async extendCarbonation(id: number, extendMinutes: number) {
    const batch = await prisma.batch.findUnique({ where: { id } });
    if (!batch) {
      return null;
    }
    return await prisma.batch.update({
      where: { id },
      data: { carbExtendMinutes: (batch.carbExtendMinutes ?? 0) + extendMinutes },
    });
  }

  public static async finishCarbonation(id: number) {
    return await prisma.batch.update({
      where: { id },
      data: { carbStatus: 'finished', phase: BatchPhase.COMPLETED, completedAt: new Date() },
    });
  }

  public static async endBatch(id: number) {
    return await prisma.batch.update({ where: { id }, data: { phase: BatchPhase.CANCELED } });
  }

  // Hides a finished/canceled batch from the main Sessions list without deleting its history.
  public static async archiveBatch(id: number) {
    return await prisma.batch.update({ where: { id }, data: { archived: true } });
  }

  // Permanently erases the batch and every session/log under it — unlike endBatch, this can't be undone.
  public static async deleteBatch(id: number) {
    const sessions = await prisma.session.findMany({ where: { batchId: id }, select: { id: true } });
    const sessionIds = sessions.map((s: { id: number }) => s.id);
    await prisma.sessionLog.deleteMany({ where: { sessionId: { in: sessionIds } } });
    await prisma.session.deleteMany({ where: { batchId: id } });
    await prisma.batch.delete({ where: { id } });
  }
}
