import prisma from '~/services/prisma.server';
import type { DeviceType } from './device.server';

type DeviceFirmwareConfig = Record<DeviceType, { version: string; file: string }>;

export class ConfigRepository {
  public static async getConfig<T = any>(key: string) {
    const config = await prisma.config.findFirst({ where: { key } });
    return config ? (JSON.parse(config.value) as T) : null;
  }

  public static async getDeviceFirmware(deviceType: DeviceType) {
    const firmware = await this.getConfig<DeviceFirmwareConfig>('DEVICE_FIRMWARE');
    return (firmware && firmware[deviceType]) || null;
  }
}
