// Chakra imports
import { Box, Flex } from '@chakra-ui/react';
// Layout components
import { Outlet } from '@remix-run/react';
import { ToastProvider, createToast } from '~/components/Toasts/ToastProvider';
import { Sidebar } from '~/components/sidebar/Sidebar';
import { Topbar } from '~/components/navbar/Topbar';
import { DeviceType } from '~/types';
import { useServerSideEvent } from '~/utils/sse';
import nav from './nav';

type DeviceDetectedData = { uid: string; deviceType: DeviceType | null; isRegistered: boolean };

const DETECTED_DEVICE_LABEL: Partial<Record<DeviceType, string>> = {
  [DeviceType.PICOFERM]: 'PicoFerm',
  [DeviceType.ISPINDEL]: 'iSpindel',
  [DeviceType.TILT]: 'Tilt',
};

export const MainLayout = () => {
  useServerSideEvent<DeviceDetectedData>('device-detected', (data) => {
    if (data.isRegistered) {
      return;
    }

    // Pico S/C/Pro all hit the same registration endpoint, so the model can't be told apart yet —
    // the admin picks it when pairing from the Devices settings page.
    const deviceName = (data.deviceType && DETECTED_DEVICE_LABEL[data.deviceType]) || 'PicoBrew';

    createToast({
      title: 'New Device Detected',
      message: `A new "${deviceName}" device has been detected — pair it from Settings > Devices`,
      duration: 10000,
    });
  });

  return (
    <Flex minH="100vh" w="100%" bg="ink.bg">
      <Sidebar routes={nav} />
      <Box flex="1" minW="0" display="flex" flexDirection="column">
        <Topbar routes={nav} />
        <ToastProvider>
          <Box px={{ base: '16px', md: '32px' }} pt="28px" pb="48px" display="flex" flexDirection="column" gap="22px">
            <Outlet />
          </Box>
        </ToastProvider>
      </Box>
    </Flex>
  );
};
