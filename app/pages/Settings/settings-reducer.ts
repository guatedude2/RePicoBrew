import { z } from 'zod';
import type { PayloadAction } from '~/utils/use-tiny-reducer';
import { createTinyReducer, useTinyReducer } from '~/utils/use-tiny-reducer';

// Accepts an IPv4 address, a fully-qualified domain name, or a single-label hostname (the common
// case for a Pi — e.g. "repicobrew-01", resolvable via mDNS as "repicobrew-01.local").
const hostnameValidator = z
  .string()
  .min(1)
  .regex(
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/,
    'Invalid hostname',
  );

export type SaveState = 'idle' | 'saving' | 'restarting';

interface ReducerState {
  isGeneralSectionDirty: boolean;
  isAPSectionDirty: boolean;
  isWifiSectionDirty: boolean;
  hostName: string;
  isHostNameError: string | null;
  apNetworkName: string;
  apNetworkNameError: string | null;
  apPassword: string;
  apPasswordError: string | null;
  showAPPassword: boolean;
  wifiNetworkName: string;
  wifiNetworkNameError: string | null;
  wifiPassword: string;
  wifiPasswordError: string | null;
  showWifiPassword: boolean;
  generalSaveState: SaveState;
  apSaveState: SaveState;
  wifiSaveState: SaveState;
}

export interface SettingsInitialValues {
  hostName?: string;
  apNetworkName?: string;
  apPassword?: string;
  wifiNetworkName?: string;
  wifiPassword?: string;
}

const baseInitialState: ReducerState = {
  isGeneralSectionDirty: false,
  isAPSectionDirty: false,
  isWifiSectionDirty: false,
  hostName: '',
  isHostNameError: null,
  apNetworkName: '',
  apNetworkNameError: null,
  apPassword: '',
  apPasswordError: null,
  showAPPassword: false,
  wifiNetworkName: '',
  wifiNetworkNameError: null,
  wifiPassword: '',
  wifiPasswordError: null,
  showWifiPassword: false,
  generalSaveState: 'idle',
  apSaveState: 'idle',
  wifiSaveState: 'idle',
};

const tinyReducer = createTinyReducer({
  initialState: baseInitialState,
  reducers: {
    hydrate(state, { payload }: PayloadAction<SettingsInitialValues>) {
      if (payload.hostName !== undefined) {
        state.hostName = payload.hostName;
      }
      if (payload.apNetworkName !== undefined) {
        state.apNetworkName = payload.apNetworkName;
      }
      if (payload.apPassword !== undefined) {
        state.apPassword = payload.apPassword;
      }
      if (payload.wifiNetworkName !== undefined) {
        state.wifiNetworkName = payload.wifiNetworkName;
      }
      if (payload.wifiPassword !== undefined) {
        state.wifiPassword = payload.wifiPassword;
      }
    },
    setGeneralSaveState(state, { payload }: PayloadAction<SaveState>) {
      state.generalSaveState = payload;
      if (payload === 'idle') {
        state.isGeneralSectionDirty = false;
      }
    },
    setApSaveState(state, { payload }: PayloadAction<SaveState>) {
      state.apSaveState = payload;
      if (payload === 'idle') {
        state.isAPSectionDirty = false;
      }
    },
    setWifiSaveState(state, { payload }: PayloadAction<SaveState>) {
      state.wifiSaveState = payload;
      if (payload === 'idle') {
        state.isWifiSectionDirty = false;
      }
    },
    setHostName(state, { payload }: PayloadAction<string>) {
      state.hostName = payload;
      state.isHostNameError = null;
      state.isGeneralSectionDirty = true;
    },
    setApNetworkName(state, { payload }: PayloadAction<string>) {
      state.apNetworkName = payload;
      state.apNetworkNameError = null;
      state.isAPSectionDirty = true;
    },
    setApPassword(state, { payload }: PayloadAction<string>) {
      state.apPassword = payload;
      state.apPasswordError = null;
      state.isAPSectionDirty = true;
    },
    setShowAPPassword(state, { payload }: PayloadAction<boolean>) {
      state.showAPPassword = payload;
    },
    setWifiNetworkName(state, { payload }: PayloadAction<string>) {
      state.wifiNetworkName = payload;
      state.wifiNetworkNameError = null;
      state.isWifiSectionDirty = true;
    },
    setWifiPassword(state, { payload }: PayloadAction<string>) {
      state.wifiPassword = payload;
      state.wifiPasswordError = null;
      state.isWifiSectionDirty = true;
    },
    setShowWifiPassword(state, { payload }: PayloadAction<boolean>) {
      state.showWifiPassword = payload;
    },
    validateHostnameSection(state, { payload }: PayloadAction<(valid: boolean) => void>) {
      state.isHostNameError = hostnameValidator.safeParse(state.hostName).success
        ? null
        : 'A valid hostname is required';
      payload(!state.isHostNameError);
    },
  },
});

export const useSettingsReducer = () => useTinyReducer(tinyReducer);
