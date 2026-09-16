import type { SessionType } from './repositories/session.server';

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
  TILT = 'TILT',
}

export enum DeviceLogType {
  ERROR = 'ERROR',
  REGISTER = 'REGISTER',
  STATE_CHANGE = 'STATE_CHANGE',
  SESSION_CREATED = 'SESSION_CREATED',
  FIRMWARE_UPDATE_WARNING = 'FIRMWARE_UPDATE_WARNING',
  FIRMWARE_UPDATED = 'FIRMWARE_UPDATED',
  DEEP_CLEAN_WARNING = 'DEEP_CLEAN_WARNING',
}

export type DeviceLogData =
  | { type: DeviceLogType.ERROR; errorCode: number; sessionUID?: string }
  | { type: DeviceLogType.REGISTER; ip: string | null }
  | { type: DeviceLogType.STATE_CHANGE; state: DeviceState }
  | { type: DeviceLogType.SESSION_CREATED; sesType: SessionType }
  | { type: DeviceLogType.FIRMWARE_UPDATE_WARNING; current: string | null; to: string }
  | { type: DeviceLogType.FIRMWARE_UPDATED; from: string | null; to: string }
  | { type: DeviceLogType.DEEP_CLEAN_WARNING; sesOverCount: number };
