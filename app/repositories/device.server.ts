import prisma from '~/services/prisma.server';
import type { DeviceLogData, DeviceState } from '~/types';
import { DeviceType } from '~/types';

export class DeviceRepository {
  public static async createDevice(uid: string, name: string, deviceType: DeviceType = DeviceType.PICOBREW_C) {
    return await prisma.device.create({
      data: {
        uid,
        name,
        deviceType,
        state: 0,
      },
    });
  }

  public static async listDevices() {
    return await prisma.device.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { sessions: true },
        },
      },
    });
  }

  public static async getDeviceByUID(uid: string) {
    return await prisma.device.findFirst({ where: { uid } });
  }

  public static async updateDeviceIPAddress(id: number, ipAddress: string | null) {
    return await prisma.device.update({ where: { id }, data: { ipAddress } });
  }

  public static async updateDeviceFirmwareVersion(id: number, firmwareVersion: string) {
    return await prisma.device.update({ where: { id }, data: { firmwareVersion } });
  }

  public static async updateDeviceState(id: number, state: DeviceState) {
    return await prisma.device.update({ where: { id }, data: { state } });
  }

  public static async updateDeviceSessionCount(id: number, sessionCount: number) {
    return await prisma.device.update({ where: { id }, data: { sessionCount } });
  }

  public static async updateDeviceDeepCleanSession(id: number, lastDeepCleanSession: number) {
    return await prisma.device.update({ where: { id }, data: { lastDeepCleanSession } });
  }

  public static async createDeviceLog(deviceId: number, data: DeviceLogData) {
    return await prisma.deviceLog.create({ data: { deviceId, data: JSON.stringify(data) } });
  }

  public static async listDeviceLogs(deviceId: number, limit = 50) {
    return await prisma.deviceLog.findMany({
      where: { deviceId },
      orderBy: { time: 'desc' },
      take: limit,
    });
  }
}
