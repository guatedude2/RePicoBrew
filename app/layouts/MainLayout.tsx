import { Outlet, useRevalidator, useRouteLoaderData } from 'react-router';
import { ToastProvider, createToast } from '~/components/Toasts/ToastProvider';
import { AiBrewmasterSidekick } from '~/components/recipes/AiBrewmasterModal';
import { AiSidekickProvider } from '~/components/recipes/AiSidekickContext';
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
  const revalidator = useRevalidator();
  // A registered device checking in or dropping off changes its Online badge and whether it can be
  // picked on the New Session page — the loaders only run on navigation, so refresh the page's data.
  useServerSideEvent('device-availability-update', () => {
    revalidator.revalidate();
  });
  useServerSideEvent<DeviceDetectedData>('device-detected', (data) => {
    if (data.isRegistered) {
      revalidator.revalidate();
      return;
    }

    // Reload the current page's data so a newly discovered device shows up in Settings > Devices
    // right away — the loaders only run on navigation, so without this the list stays stale until
    // the page is manually refreshed.
    revalidator.revalidate();

    // Pico S/C/Pro all hit the same registration endpoint, so the model can't be told apart yet —
    // the admin picks it when pairing from the Devices settings page.
    const deviceName = (data.deviceType && DETECTED_DEVICE_LABEL[data.deviceType]) || 'PicoBrew';

    createToast({
      title: 'New Device Detected',
      message: `A new "${deviceName}" device has been detected — pair it from Settings > Devices`,
      duration: 10000,
    });
  });

  // Rendered once here (rather than per-page, as it used to be inside the two recipe editors) so
  // the AI Brewmaster sidekick FAB is available everywhere — AiSidekickProvider lets whichever
  // recipe editor is currently mounted (if any) hand it live recipe state; see AiSidekickContext.tsx.
  const hasAiKey = Boolean(useRouteLoaderData<typeof import('~/routes/_admin').loader>('routes/_admin')?.hasAiKey);

  return (
    <TooltipProvider delayDuration={200}>
      <AiSidekickProvider>
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
        {hasAiKey && <AiBrewmasterSidekick />}
      </AiSidekickProvider>
    </TooltipProvider>
  );
};
