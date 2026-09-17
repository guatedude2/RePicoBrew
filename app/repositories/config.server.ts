import prisma from '~/services/prisma.server';
import type { DeviceType } from '~/types';

type DeviceConfig<K> = Record<DeviceType, K>;

export class ConfigRepository {
  public static async getConfig<T = unknown>(key: string) {
    const config = await prisma.config.findFirst({ where: { key } });
    return config ? (JSON.parse(config.value) as T) : null;
  }

  public static async getDeviceFirmware(deviceType: DeviceType) {
    const config = await this.getConfig<DeviceConfig<{ version: string; file: string }>>('DEVICE_FIRMWARE');
    return (config && config[deviceType]) || null;
  }

  public static async getDeviceSessionsToDeepClean(deviceType: DeviceType) {
    const config = await this.getConfig<DeviceConfig<number>>('DEVICE_MAX_SESSIONS_TO_DEEP_CLEAN');
    return (config && config[deviceType]) || null;
  }

  public static async setConfig<T = unknown>(key: string, value: T) {
    return await prisma.config.upsert({
      where: { key },
      create: { key, value: JSON.stringify(value) },
      update: { value: JSON.stringify(value) },
    });
  }
}
