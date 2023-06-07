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
    return await prisma.session.findFirst({ where: { deviceId } });
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

  public static async createSessionLogEntry(sessionId: number, data: SessionLogData) {
    return await prisma.sessionLog.create({
      data: { sessionId, data: JSON.stringify(data) },
    });
  }
}
