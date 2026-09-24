import { useRef, type CSSProperties, type FC, type ReactNode } from 'react';
import { MdMoreVert } from 'react-icons/md';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';

const ACTIONS = [
  { label: 'Zoom in', icon: 'apexcharts-zoomin-icon' },
  { label: 'Zoom out', icon: 'apexcharts-zoomout-icon' },
  { label: 'Drag to zoom', icon: 'apexcharts-zoom-icon' },
  { label: 'Drag to pan', icon: 'apexcharts-pan-icon' },
  { label: 'Reset zoom', icon: 'apexcharts-reset-icon' },
];

// Wraps an ApexCharts chart and replaces its built-in icon toolbar (hidden in tailwind.css) with a three-dot menu.
// The menu items click the hidden toolbar's own icons, so zoom/pan/reset behave exactly as ApexCharts intends.
export const ChartMenu: FC<{ children: ReactNode; className?: string; style?: CSSProperties }> = ({
  children,
  className,
  style,
}) => {
  const host = useRef<HTMLDivElement>(null);
  const trigger = (icon: string) => host.current?.querySelector<HTMLElement>(`.${icon}`)?.click();

  return (
    <div ref={host} className={`chart-menu-host relative ${className ?? ''}`} style={style}>
      <div className="absolute right-0 top-0 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Chart options"
              className="flex size-7 items-center justify-center rounded-md text-ink-text-faint transition-colors hover:bg-ink-card hover:text-ink-text"
            >
              <MdMoreVert className="size-[18px]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {ACTIONS.map((action) => (
              <DropdownMenuItem key={action.icon} onSelect={() => trigger(action.icon)}>
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {children}
    </div>
  );
};
