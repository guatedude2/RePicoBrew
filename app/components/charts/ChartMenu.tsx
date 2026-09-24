import { useEffect, useRef, useState, type CSSProperties, type FC, type ReactNode } from 'react';
import type { IconType } from 'react-icons';
import {
  MdFileDownload,
  MdHighlightAlt,
  MdImage,
  MdMoreVert,
  MdPanTool,
  MdRestartAlt,
  MdTableChart,
  MdZoomIn,
  MdZoomOut,
} from 'react-icons/md';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { cn } from '~/lib/utils';

type Tool = { label: string; icon: IconType; apex: string; mode?: 'zoom' | 'pan' };

const TOOLS: Tool[] = [
  { label: 'Zoom in', icon: MdZoomIn, apex: 'apexcharts-zoomin-icon' },
  { label: 'Zoom out', icon: MdZoomOut, apex: 'apexcharts-zoomout-icon' },
  { label: 'Drag to zoom', icon: MdHighlightAlt, apex: 'apexcharts-zoom-icon', mode: 'zoom' },
  { label: 'Drag to pan', icon: MdPanTool, apex: 'apexcharts-pan-icon', mode: 'pan' },
  { label: 'Reset zoom', icon: MdRestartAlt, apex: 'apexcharts-reset-icon' },
];

const DOWNLOADS = [
  { label: 'Download SVG', icon: MdFileDownload, apex: 'exportSVG' },
  { label: 'Download PNG', icon: MdImage, apex: 'exportPNG' },
  { label: 'Download CSV', icon: MdTableChart, apex: 'exportCSV' },
];

// Wraps an ApexCharts chart and replaces its built-in toolbar (hidden in tailwind.css) with app-styled icon buttons
// plus a three-dot menu for downloads. Every control clicks the hidden toolbar's own element, so zoom/pan/reset and
// the exports behave exactly as ApexCharts intends.
export const ChartMenu: FC<{ children: ReactNode; className?: string; style?: CSSProperties }> = ({
  children,
  className,
  style,
}) => {
  const host = useRef<HTMLDivElement>(null);
  const [activeMode, setActiveMode] = useState<'zoom' | 'pan' | null>(null);

  // Apex marks the active zoom/pan mode with a class on its own icon — mirror it on our buttons.
  useEffect(() => {
    const el = host.current;
    if (!el) {
      return;
    }
    const sync = () => {
      const selected = (cls: string) => el.querySelector(`.${cls}`)?.classList.contains('apexcharts-selected');
      if (selected('apexcharts-pan-icon')) {
        setActiveMode('pan');
      } else {
        setActiveMode(selected('apexcharts-zoom-icon') ? 'zoom' : null);
      }
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const click = (selector: string) => host.current?.querySelector<HTMLElement>(`.${selector}`)?.click();

  return (
    <div ref={host} className={cn('chart-menu-host relative', className)} style={style}>
      <div className="absolute right-0 top-0 z-10 flex items-center gap-0.5">
        {TOOLS.map(({ label, icon: Icon, apex, mode }) => (
          <button
            key={apex}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={mode ? activeMode === mode : undefined}
            onClick={() => click(apex)}
            className={cn(
              'flex size-7 items-center justify-center rounded-md text-ink-text-faint transition-colors hover:bg-ink-card hover:text-ink-text',
              mode && activeMode === mode && 'bg-ink-card text-brand-500 hover:text-brand-500',
            )}
          >
            <Icon className="size-[17px]" />
          </button>
        ))}
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
            {DOWNLOADS.map(({ label, icon: Icon, apex }) => (
              <DropdownMenuItem key={apex} onSelect={() => click(apex)}>
                <Icon className="size-4" />
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {children}
    </div>
  );
};
