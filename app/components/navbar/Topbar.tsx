import { Link as RemixLink, useFetcher, useLocation, useRouteLoaderData } from 'react-router';
import type { FC } from 'react';
import { MdCheckCircle, MdLogout, MdNotificationsNone, MdOutlinePerson, MdWarning } from 'react-icons/md';
import type { NavItem } from '~/layouts/nav';
import { Badge } from '~/components/ui/badge';
import { SidebarDrawer } from '~/components/sidebar/Sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { attentionMessage } from '~/utils/batch-phase';
import { cn } from '~/lib/utils';
import { formatRelativeTime } from '~/utils/relative-time';

const ROLE_LABEL: Record<string, string> = {
  Regular: 'Regular User',
  ReadOnly: 'Read-only',
};

const initialsFor = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

export const Topbar: FC<{ routes: NavItem[] }> = ({ routes }) => {
  const { pathname } = useLocation();
  const current = routes.find((r) => pathname.startsWith(r.path));
  const adminData = useRouteLoaderData<typeof import('~/routes/_admin').loader>('routes/_admin');
  const session = adminData?.session;
  const attentionBatches = adminData?.attentionBatches ?? [];
  const logoutFetcher = useFetcher();

  return (
    <div
      className="sticky top-0 z-[2] flex flex-wrap items-center justify-between gap-4 border-b border-ink-border px-4 py-[18px] backdrop-blur-[6px] md:px-8"
      style={{ backgroundColor: 'oklch(0.15 0.004 260 / 0.92)' }}
    >
      <div className="flex items-center gap-3.5">
        <SidebarDrawer routes={routes} />
        <p className="text-xl font-bold">{current?.name ?? 'RePicoBrew'}</p>
      </div>
      <div className="flex items-center gap-3.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Notifications"
              className="relative flex size-[34px] items-center justify-center rounded-lg border border-ink-card-border bg-ink-card"
            >
              <MdNotificationsNone className="size-4 text-ink-text-muted" />
              {attentionBatches.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full border-[1.5px] border-ink-bg bg-brand-500" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-96 overflow-hidden p-0">
            <div className="flex items-center gap-2 border-b border-ink-divider px-4 py-3">
              <MdNotificationsNone className="size-4 text-ink-text-faint" />
              <span className="text-sm font-medium">Notifications</span>
              {attentionBatches.length > 0 && (
                <Badge variant="subtle" className="font-normal">
                  {attentionBatches.length} pending
                </Badge>
              )}
            </div>
            {attentionBatches.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 px-3 py-6">
                <MdCheckCircle className="size-5 text-success-500" />
                <p className="text-xs text-ink-text-faint">All caught up</p>
              </div>
            ) : (
              <>
                <div className="max-h-[360px] overflow-y-auto">
                  {attentionBatches.map((batch, index) => (
                    <DropdownMenuItem key={batch.id} asChild className="items-start whitespace-normal rounded-none">
                      <RemixLink
                        to={batch.sessionId ? `/sessions/${batch.sessionId}` : '/sessions'}
                        className={cn(
                          'gap-3 px-4 py-3',
                          index < attentionBatches.length - 1 && 'border-b border-ink-divider',
                        )}
                      >
                        <MdWarning className="mt-0.5 size-4 shrink-0 text-orange-400" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{batch.name}</p>
                          <p className="mt-0.5 truncate text-xs text-ink-text-faint">{attentionMessage(batch.phase)}</p>
                        </div>
                        <span className="shrink-0 text-xs text-ink-text-faintest">
                          {formatRelativeTime(batch.updatedAt)}
                        </span>
                      </RemixLink>
                    </DropdownMenuItem>
                  ))}
                </div>
                <div className="border-t border-ink-divider px-4 py-2.5">
                  <p className="text-center text-xs text-ink-text-faint">
                    Showing {attentionBatches.length} of {attentionBatches.length}
                  </p>
                </div>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Account menu"
              className="flex size-[34px] items-center justify-center rounded-full border border-ink-border-strong bg-gradient-to-br from-gray-500 to-gray-700 text-[13px] font-bold text-white"
            >
              {session ? initialsFor(session.name) : ''}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {session && (
              <div className="px-3 py-2">
                <p className="text-sm font-bold">{session.name}</p>
                <p className="text-xs text-ink-text-faint">{ROLE_LABEL[session.role] ?? session.role}</p>
              </div>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <RemixLink to="/profile">
                <MdOutlinePerson className="size-4" />
                My Profile
              </RemixLink>
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="danger"
              disabled={logoutFetcher.state !== 'idle'}
              onClick={() => logoutFetcher.submit({}, { method: 'post', action: '/logout' })}
            >
              <MdLogout className="size-4" />
              Log Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default Topbar;
