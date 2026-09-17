import { Outlet } from 'react-router';
import { ToastProvider, createToast } from '~/components/Toasts/ToastProvider';
import { Sidebar } from '~/components/sidebar/Sidebar';
import { Topbar } from '~/components/navbar/Topbar';
import { TooltipProvider } from '~/components/ui/tooltip';
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
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-screen w-full bg-ink-bg">
        <Sidebar routes={nav} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar routes={nav} />
          <ToastProvider>
            <div className="flex flex-col gap-[22px] px-4 pb-12 pt-7 md:px-8">
              <Outlet />
            </div>
          </ToastProvider>
        </div>
      </div>
    </TooltipProvider>
  );
};
