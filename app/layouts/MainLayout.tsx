// Chakra imports
import { Box, Flex } from '@chakra-ui/react';
// Layout components
import { Outlet, useLoaderData } from '@remix-run/react';
import { ToastProvider, createToast } from '~/components/Toasts/ToastProvider';
import { Sidebar } from '~/components/sidebar/Sidebar';
import { Topbar } from '~/components/navbar/Topbar';
import { DeviceType } from '~/types';
import { useServerSideEvent } from '~/utils/sse';
import nav from './nav';

type DeviceDetectedData = { uid: string; type: DeviceType.PICOBREW_C; isRegistered: boolean };

export const MainLayout = () => {
  const { deviceStatus } = useLoaderData<typeof import('~/routes/_admin').loader>();

  useServerSideEvent<DeviceDetectedData>('device-detected', (data) => {
    if (data.isRegistered) {
      return;
    }

    const deviceName = data.type === DeviceType.PICOBREW_C ? 'PicoBrew C' : 'Unknown';

    createToast({
      title: 'New Device Detected',
      message: `A new "${deviceName}" device has been detected`,
      duration: 10000,
    });
  });

  return (
    <Flex minH="100vh" w="100%" bg="ink.bg">
      <Sidebar routes={nav} online={deviceStatus.online} total={deviceStatus.total} />
      <Box flex="1" minW="0" display="flex" flexDirection="column">
        <Topbar routes={nav} online={deviceStatus.online} total={deviceStatus.total} />
        <ToastProvider>
          <Box px={{ base: '16px', md: '32px' }} pt="28px" pb="48px" display="flex" flexDirection="column" gap="22px">
            <Outlet />
          </Box>
        </ToastProvider>
      </Box>
    </Flex>
  );
};
