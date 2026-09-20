import prisma from '~/services/prisma.server';
import { SessionState, SessionType } from '~/types';
import { QUEUE_EXPIRY_MS, QUEUED_STATUS_TEXT } from '~/utils/queued-brew';

export type SessionLogData = Record<string, unknown>;

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
}
