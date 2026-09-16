import { z } from 'zod';
import type { PayloadAction } from '~/utils/use-tiny-reducer';
import { createTinyReducer, useTinyReducer } from '~/utils/use-tiny-reducer';

const hostnameValidator = z
  .string()
  .min(1)
  .regex(
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)+([A-Za-z]|[A-Za-z][A-Za-z0-9\-]*[A-Za-z0-9])$/,
    'Invalid hostname',
  );

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
}

const initialState: ReducerState = {
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
};

const tinyReducer = createTinyReducer({
  initialState,
  reducers: {
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
