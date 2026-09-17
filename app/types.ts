// Session enums
export enum SessionType {
  BREWING = 0,
  DEEP_CLEAN = 1,
  SOUS_VIDE = 2,
  FERMENTATION = 3,
  COLD_BREW = 4,
  MANUAL_BREW = 5,
}

export enum SessionState {
  READY = 0,
  IN_PROGRESS,
  COMPLETED,
  CANCELED,
}

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
  // Pico S / Pico Pro — the reference server treats these as the same base "PicoBrew" model,
  // sharing the PicoBrew C wire protocol rather than having their own.
  PICOBREW = 'PICOBREW',
  ZYMATIC = 'ZYMATIC',
  ZSERIES = 'ZSERIES',
  PICOFERM = 'PICOFERM',
  ISPINDEL = 'ISPINDEL',
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

// Machine-facing Pico step location, matching the firmware wire protocol (see api.pico.getRecipe.ts)
export enum PicoLocationMap {
  Prime = 0,
  Mash = 1,
  PassThru = 2,
  Adjunct1 = 3,
  Adjunct2 = 4,
  Adjunct3 = 6,
  Adjunct4 = 5,
}

// Sections of the brew-science ingredient/step lists (Recipe Editor). Distinct from the
// machine-facing `PicoLocationMap` above, which is the real firmware program.
export enum IngredientSection {
  WATER = 'WATER',
  MASH_STEP = 'MASH_STEP',
  FERMENTABLE = 'FERMENTABLE',
  BOIL_HOP = 'BOIL_HOP',
  OTHER_BOIL = 'OTHER_BOIL',
  FERMENTATION_STEP = 'FERMENTATION_STEP',
  DRY_HOP = 'DRY_HOP',
}

// A Batch's overall lifecycle stage (brew -> ferment -> carbonate -> done), independent of the
// underlying Session.state values for its individual Brewing/Fermentation legs.
export enum BatchPhase {
  BREWING = 'Brewing',
  COOLING = 'Cooling',
  FERMENTING = 'Fermenting',
  BOTTLING = 'Bottling',
  CARBONATING = 'Carbonating',
  COMPLETED = 'Completed',
  CANCELED = 'Canceled',
}

export type DeviceLogData =
  | { type: DeviceLogType.ERROR; errorCode: number; sessionUID?: string }
  | { type: DeviceLogType.REGISTER; ip: string | null }
  | { type: DeviceLogType.STATE_CHANGE; state: DeviceState }
  | { type: DeviceLogType.SESSION_CREATED; sesType: SessionType }
  | { type: DeviceLogType.FIRMWARE_UPDATE_WARNING; current: string | null; to: string }
  | { type: DeviceLogType.FIRMWARE_UPDATED; from: string | null; to: string }
  | { type: DeviceLogType.DEEP_CLEAN_WARNING; sesOverCount: number };
