import { Link, useLocation } from 'react-router';
import { useState, type FC } from 'react';
import { IoMenuOutline } from 'react-icons/io5';
import { Sheet, SheetContent, SheetTrigger } from '~/components/ui/sheet';
import { cn } from '~/lib/utils';
import type { NavItem } from '~/layouts/nav';

const Logo: FC = () => (
  <div className="flex items-center gap-2.5">
    <div className="flex size-[34px] flex-none items-center justify-center rounded-lg bg-gradient-to-br from-brand-300 to-brand-600">
      <svg viewBox="0 0 24 24" className="size-[18px] text-ink-on-brand">
        <path d="M6 3h10l1 4H5l1-4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path
          d="M5 7h14l-1.4 12.2A2 2 0 0 1 15.6 21H8.4a2 2 0 0 1-2-1.8L5 7z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
    <div className="leading-[1.1]">
      <p className="text-[15px] font-bold tracking-[0.5px]">REPICOBREW</p>
      <p className="text-[11px] tracking-[1px] text-ink-text-faint">CONTROL DECK</p>
    </div>
  </div>
);

const NavSection: FC<{ label: string; items: NavItem[]; pathname: string }> = ({ label, items, pathname }) => (
  <>
    <p className="px-3 pb-1.5 pt-4 text-[11px] font-semibold tracking-[1px] text-ink-text-faintest">{label}</p>
    {items.map((item) => {
      const isActive = pathname.startsWith(item.path);
      return (
        <Link key={item.path} to={item.path} className="no-underline">
          <div
            className={cn(
              'flex items-center gap-3 rounded-lg border-l-[3px] px-3 py-2.5 text-sm transition-colors',
              isActive
                ? 'border-l-brand-500 bg-brand-100 font-semibold text-ink-text'
                : 'border-l-transparent font-medium text-ink-text-muted hover:text-ink-text',
            )}
          >
            {item.icon}
            <span>{item.name}</span>
          </div>
        </Link>
      );
    })}
  </>
);

const SidebarBody: FC<{ pathname: string; routes: NavItem[] }> = ({ pathname, routes }) => {
  const brewing = routes.filter((r) => r.section === 'BREWING');
  const system = routes.filter((r) => r.section === 'SYSTEM');
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-ink-border px-5 py-6">
        <Logo />
      </div>
      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
        <NavSection label="BREWING" items={brewing} pathname={pathname} />
        <NavSection label="SYSTEM" items={system} pathname={pathname} />
      </div>
    </div>
  );
};

export function Sidebar({ routes }: { routes: NavItem[] }) {
  const { pathname } = useLocation();

  return (
    <div className="sticky top-0 hidden h-screen w-[240px] flex-[0_0_240px] border-r border-ink-border bg-ink-sidebar md:block">
      <SidebarBody pathname={pathname} routes={routes} />
    </div>
  );
}

export function SidebarDrawer({ routes }: { routes: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <div className="block md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button type="button" aria-label="Open menu" className="flex items-center text-ink-text">
            <IoMenuOutline className="size-6" />
          </button>
        </SheetTrigger>
        <SheetContent className="p-0">
          <SidebarBody pathname={pathname} routes={routes} />
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default Sidebar;
