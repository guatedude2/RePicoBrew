import prisma from '~/services/prisma.server';

export type SessionLogData = any;

// 0 = Brewing, 1 = Deep Clean, 2 = Sous Vide
export enum SessionType {
  BREWING = 0,
  DEEP_CLEAN = 1,
  SOUS_VIDE = 2,
  COLD_BREW = 4,
  MANUAL_BREW = 5,
}

export enum SessionState {
  READY = 0,
  IN_PROGRESS,
  COMPLETED,
  CANCELED,
}

export class SessionRepository {
  public static async createSession(
    uid: string,
    type: SessionType,
    deviceId: number,
    recipeId?: number,
    timeRemaining?: number,
  ) {
    return await prisma.session.create({
      data: {
        uid,
        type,
        deviceId,
        recipeId,
        state: SessionState.READY,
        statusText: 'Ready to Brew',
        timeRemaining,
      },
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
        recipe: true,
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

  public static async listSessionLogs(sessionId: number) {
    return await prisma.sessionLog.findMany({
      where: { sessionId },
      orderBy: { time: 'asc' },
    });
  }
}
