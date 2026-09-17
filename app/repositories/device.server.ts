import prisma from '~/services/prisma.server';
import type { DeviceLogData, DeviceState } from '~/types';
import { DeviceType } from '~/types';

const TILT_ONLINE_WINDOW_MS = 10 * 60 * 1000;

export class DeviceRepository {
  // Claiming turns a passively-seen uid into a real, named Device — used by the Devices settings
  // page's pairing dialog, whether the uid came from the Discovered list or was typed in manually.
  public static async claimDevice(
    uid: string,
    name: string,
    deviceType: DeviceType,
    options?: { color?: string; metadata?: Record<string, unknown> },
  ) {
    const [device] = await prisma.$transaction([
      prisma.device.create({
        data: {
          uid,
          name,
          deviceType,
          state: 0,
          color: options?.color,
          metadata: options?.metadata ? JSON.stringify(options.metadata) : null,
        },
      }),
      prisma.discoveredDevice.deleteMany({ where: { uid } }),
    ]);
    return device;
  }

  // Upserts a "seen but not yet claimed" uid. `deviceType` is null when the wire protocol can't
  // disambiguate the model (Pico S/C/Pro all hit the same endpoint) — the admin picks it at claim time.
  public static async upsertDiscoveredDevice(
    uid: string,
    deviceType: DeviceType | null,
    metadata?: Record<string, unknown>,
  ) {
    return await prisma.discoveredDevice.upsert({
      where: { uid },
      create: { uid, deviceType, metadata: metadata ? JSON.stringify(metadata) : null },
      update: { deviceType, metadata: metadata ? JSON.stringify(metadata) : undefined },
    });
  }

  public static async listDiscoveredDevices() {
    return await prisma.discoveredDevice.findMany({ orderBy: { lastSeenAt: 'desc' } });
  }

  public static async dismissDiscoveredDevice(uid: string) {
    await prisma.discoveredDevice.deleteMany({ where: { uid } });
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

  public static async getDeviceById(id: number) {
    return await prisma.device.findFirst({ where: { id } });
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

  public static async updateDeviceColor(id: number, color: string) {
    return await prisma.device.update({ where: { id }, data: { color } });
  }

  public static async updateDeviceMetadata(id: number, metadata: Record<string, unknown>) {
    return await prisma.device.update({ where: { id }, data: { metadata: JSON.stringify(metadata) } });
  }

  public static async updateDeviceName(id: number, name: string) {
    return await prisma.device.update({ where: { id }, data: { name } });
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

  public static isDeviceOnline(device: { deviceType: string; ipAddress: string | null; metadata: string | null }) {
    if (device.deviceType === DeviceType.TILT) {
      try {
        const metadata = device.metadata ? JSON.parse(device.metadata) : {};
        return (
          typeof metadata.lastSeen === 'string' &&
          Date.now() - new Date(metadata.lastSeen).getTime() < TILT_ONLINE_WINDOW_MS
        );
      } catch {
        return false;
      }
    }
    return Boolean(device.ipAddress);
  }

  public static async getStatus() {
    const devices = await this.listDevices();
    return {
      total: devices.length,
      online: devices.filter((device) => this.isDeviceOnline(device)).length,
    };
  }
}
