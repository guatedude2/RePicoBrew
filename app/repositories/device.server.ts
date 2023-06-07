import prisma from '~/services/prisma.server';

export enum DeviceState {
  READY = 2,
  BREWING = 3,
  SOUS_VIDE = 4,
  RACK_BEER = 5,
  RINSE = 6,
  DEEP_CLEAN = 7,
  DE_SCALE = 9,
}

export enum DeviceType {
  PICOBREW_C = 'PICOBREW_C',
  // PICOBREW_PRO_S = 'PICOBREW_PRO_S',
  // ZYMATIC = 'ZYMATIC',
  // ZSERIES = 'ZSERIES',
  // PICOFERM = 'PICOFERM',
  // PICOSTILL_ISPINDEL = 'PICOSTILL_ISPINDEL',
  // TILT = 'TILT',
}

export class DeviceRepository {
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
}
