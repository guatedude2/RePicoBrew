// Chakra imports
import { Box, Portal, useDisclosure } from '@chakra-ui/react';
import Footer from '~/components/footer/FooterAdmin';
// Layout components
import { Outlet } from '@remix-run/react';
import { useState } from 'react';
import { ToastProvider, createToast } from '~/components/Toasts/ToastProvider';
import Navbar from '~/components/navbar/NavbarAdmin';
import Sidebar from '~/components/sidebar/Sidebar';
import { DeviceType } from '~/types';
import { useServerSideEvent } from '~/utils/sse';
import { SidebarContext } from './MainLayout/contexts/SidebarContext';
import nav from './nav';

type DeviceDetectedData = { uid: string; type: DeviceType.PICOBREW_C; isRegistered: boolean };

// Custom Chakra theme
export const MainLayout = (props: { [x: string]: any }) => {
  const { ...rest } = props;
  // states and functions
  const [fixed] = useState(false);
  const [toggleSidebar, setToggleSidebar] = useState(false);

  const { onOpen } = useDisclosure();

  useServerSideEvent<DeviceDetectedData>('device-detected', (data) => {
    console.log('DD', data);
    if (data.isRegistered) {
      return;
    }

    const deviceName = data.type === DeviceType.PICOBREW_C ? 'PicoBrew C' : 'Unknown';

    createToast({
      title: 'New Device Detected',
      message: `A new "${deviceName}" device has been detected`,
      duration: 10000,
      callback: () => {
        console.log('TOAST');
      },
    });
  });

  return (
    <Box>
      <SidebarContext.Provider
        value={{
          toggleSidebar,
          setToggleSidebar,
        }}
      >
        <Sidebar routes={nav} display="none" {...rest} />
        <Box
          float="right"
          minHeight="100vh"
          height="100%"
          overflow="auto"
          position="relative"
          maxHeight="100%"
          w={{ base: '100%', xl: 'calc( 100% - 290px )' }}
          maxWidth={{ base: '100%', xl: 'calc( 100% - 290px )' }}
          transition="all 0.33s cubic-bezier(0.685, 0.0473, 0.346, 1)"
          transitionDuration=".2s, .2s, .35s"
          transitionProperty="top, bottom, width"
          transitionTimingFunction="linear, linear, ease"
        >
          <Portal>
            <Box>
              <Navbar routes={nav} onOpen={onOpen} secondary message="Message" fixed={fixed} {...rest} />
            </Box>
          </Portal>
          <ToastProvider>
            <Box mx="auto" p={{ base: '20px', md: '30px' }} pe="20px" minH="calc(100vh - 60px)" pt="50px">
              <Outlet />
            </Box>
          </ToastProvider>
          <Box>
            <Footer />
          </Box>
        </Box>
      </SidebarContext.Provider>
    </Box>
  );
};
