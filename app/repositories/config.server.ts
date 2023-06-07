import prisma from '~/services/prisma.server';
import type { DeviceType } from './device.server';

type DeviceConfig<K> = Record<DeviceType, K>;

export class ConfigRepository {
  public static async getConfig<T = any>(key: string) {
    const config = await prisma.config.findFirst({ where: { key } });
    return config ? (JSON.parse(config.value) as T) : null;
  }

  public static async getDeviceFirmware(deviceType: DeviceType) {
    const config = await this.getConfig<DeviceConfig<{ version: string; file: string }>>('DEVICE_FIRMWARE');
    return (config && config[deviceType]) || null;
  }

  public static async getDeviceSessionsToDeepClean(deviceType: DeviceType) {
    const config = await this.getConfig<DeviceConfig<number>>('DEVICE_MAX_SESSIONS_TO_DEEPCLEAN');
    return (config && config[deviceType]) || null;
  }
}
