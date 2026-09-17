import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData, useSearchParams, useFetcher, useNavigate, Link } from 'react-router';
import { useState, type FC } from 'react';
import {
  MdAdd,
  MdArchive,
  MdArrowDownward,
  MdArrowUpward,
  MdCancel,
  MdChevronLeft,
  MdChevronRight,
  MdHistory,
  MdMoreVert,
  MdWarning,
} from 'react-icons/md';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip';
import { BatchRepository } from '~/repositories/batch.server';
import { BatchPhase } from '~/types';
import { batchNeedsAttention, phaseAccent, phaseLabel } from '~/utils/batch-phase';

export const meta = () => [{ title: 'Sessions | RePicoBrew' }];

const PAGE_SIZE = 10;
type SortKey = 'date' | 'recipe' | 'device' | 'status';
type SortDir = 'asc' | 'desc';
const SORT_KEYS: SortKey[] = ['date', 'recipe', 'device', 'status'];
const DEFAULT_DIR: Record<SortKey, SortDir> = { date: 'desc', recipe: 'asc', device: 'asc', status: 'asc' };
const LIVE_PHASES: string[] = [
  BatchPhase.BREWING,
  BatchPhase.COOLING,
  BatchPhase.FERMENTING,
  BatchPhase.BOTTLING,
  BatchPhase.CARBONATING,
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const requestedPage = Number(url.searchParams.get('page'));
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;
  const sortParam = url.searchParams.get('sort');
  const sort: SortKey = SORT_KEYS.includes(sortParam as SortKey) ? (sortParam as SortKey) : 'date';
  const dirParam = url.searchParams.get('dir');
  const dir: SortDir = dirParam === 'asc' || dirParam === 'desc' ? dirParam : DEFAULT_DIR[sort];
  const { batches, total } = await BatchRepository.listPaginated(page, PAGE_SIZE, sort, dir);
  return { batches, total, page, pageSize: PAGE_SIZE, sort, dir };
};

const formatDate = (date: Date | string) =>
  new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const formatTime = (date: Date | string) =>
  new Date(date).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

const columns = '1.4fr 1.2fr 1.1fr 1.1fr 60px';

type BatchRow = ReturnType<typeof useLoaderData<typeof loader>>['batches'][number];

const SortableHeader: FC<{ label: string; sortKey: SortKey; activeSort: SortKey; dir: SortDir; href: string }> = ({
  label,
  sortKey,
  activeSort,
  dir,
  href,
}) => {
  const isActive = activeSort === sortKey;
  return (
    <Link to={href} className="no-underline">
      <div
        className={`flex items-center gap-1 hover:text-ink-text ${isActive ? 'text-ink-text' : 'text-ink-text-faint'}`}
      >
        <span>{label}</span>
        {isActive && (dir === 'asc' ? <MdArrowUpward className="size-3" /> : <MdArrowDownward className="size-3" />)}
      </div>
    </Link>
  );
};

const SessionRow: FC<{ batch: BatchRow; onRequestCancel: (batch: BatchRow) => void }> = ({
  batch,
  onRequestCancel,
}) => {
  const navigate = useNavigate();
  const archiveFetcher = useFetcher();
  const primarySession = batch.sessions[0];
  const isLive = LIVE_PHASES.includes(batch.phase);
  const isArchivable = batch.phase === BatchPhase.COMPLETED || batch.phase === BatchPhase.CANCELED;
  const needsAttention = batchNeedsAttention(batch);

  return (
    <div
      className="grid min-w-[640px] cursor-pointer items-center border-b border-ink-divider px-5 py-4 hover:bg-ink-card-hover"
      style={{ gridTemplateColumns: columns }}
      onClick={() => navigate(`/sessions/${primarySession?.id ?? ''}`)}
    >
      <p className="truncate text-[13px] font-bold">{batch.name}</p>
      <div className="flex min-w-0 items-center gap-2 text-[13px]">
        <span className="size-[7px] shrink-0 rounded-full bg-brand-500" />
        <span className="truncate">{primarySession?.device?.name || 'Unknown'}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className="rounded-md px-2.5 py-[3px] text-[11px] font-bold"
          style={{
            backgroundColor: `oklch(${phaseAccent(batch.phase)} / 0.18)`,
            color: `oklch(${phaseAccent(batch.phase)})`,
          }}
        >
          {phaseLabel(batch.phase)}
        </span>
        {needsAttention && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex">
                <MdWarning className="size-[15px] text-orange-400" />
              </span>
            </TooltipTrigger>
            <TooltipContent>Needs your input to continue</TooltipContent>
          </Tooltip>
        )}
      </div>
      <div>
        <p className="text-[13px] font-semibold">{formatDate(batch.createdAt)}</p>
        <p className="text-[11px] text-ink-text-faint">{formatTime(batch.createdAt)}</p>
      </div>
      <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
        {(isLive || isArchivable) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label="Session actions" variant="ghost" size="icon">
                <MdMoreVert className="size-[18px]" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isLive && (
                <DropdownMenuItem variant="danger" onClick={() => onRequestCancel(batch)}>
                  <MdCancel className="size-4" />
                  Cancel Session
                </DropdownMenuItem>
              )}
              {isArchivable && (
                <DropdownMenuItem
                  disabled={archiveFetcher.state !== 'idle'}
                  onClick={() =>
                    archiveFetcher.submit(
                      { intent: 'archive' },
                      { method: 'post', action: `/api/batches/${batch.id}`, encType: 'application/json' },
                    )
                  }
                >
                  <MdArchive className="size-4" />
                  Archive
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
};

export default function SessionsPage() {
  const { batches, total, page, pageSize, sort, dir } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const cancelFetcher = useFetcher();
  const [cancelTarget, setCancelTarget] = useState<{ id: number; name: string } | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, page * pageSize);

  const pageHref = (p: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(p));
    return `?${params.toString()}`;
  };

  const sortHref = (key: SortKey) => {
    let nextDir: SortDir = DEFAULT_DIR[key];
    if (sort === key) {
      nextDir = dir === 'asc' ? 'desc' : 'asc';
    }
    const params = new URLSearchParams(searchParams);
    params.set('sort', key);
    params.set('dir', nextDir);
    params.set('page', '1');
    return `?${params.toString()}`;
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[26px] font-bold tracking-[-0.3px]">Brew Sessions</p>
          <p className="mt-1 text-sm text-ink-text-dim">History of all brewing sessions</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-brand-100 px-3 py-[5px] text-xs font-bold text-brand-500">
            {total} Total
          </span>
          <Link to="/sessions/new">
            <Button variant="brand" size="sm">
              <MdAdd />
              New Session
            </Button>
          </Link>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        {batches.length === 0 ? (
          <div className="flex flex-col items-center gap-3.5 py-16">
            <div className="flex size-[72px] items-center justify-center rounded-full bg-brand-100">
              <MdHistory className="size-[34px] text-brand-500" />
            </div>
            <p className="text-lg font-bold">No Sessions Yet</p>
            <p className="max-w-[380px] text-center text-sm text-ink-text-faint">
              Start a brew on your Pico device and it will appear here with full history and logs
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <div
                className="grid min-w-[640px] border-b border-ink-divider px-5 py-3.5 text-[11px] font-bold uppercase tracking-[0.5px]"
                style={{ gridTemplateColumns: columns }}
              >
                <SortableHeader label="Recipe" sortKey="recipe" activeSort={sort} dir={dir} href={sortHref('recipe')} />
                <SortableHeader label="Device" sortKey="device" activeSort={sort} dir={dir} href={sortHref('device')} />
                <SortableHeader label="Status" sortKey="status" activeSort={sort} dir={dir} href={sortHref('status')} />
                <SortableHeader label="Date" sortKey="date" activeSort={sort} dir={dir} href={sortHref('date')} />
                <div />
              </div>
              {batches.map((batch) => (
                <SessionRow
                  key={batch.id}
                  batch={batch}
                  onRequestCancel={(b) => setCancelTarget({ id: b.id, name: b.name })}
                />
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
              <p className="text-xs text-ink-text-faint">
                Showing {rangeStart}–{rangeEnd} of {total}
              </p>
              <div className="flex items-center gap-2">
                {page <= 1 ? (
                  <Button variant="outline" size="sm" disabled>
                    <MdChevronLeft />
                    Previous
                  </Button>
                ) : (
                  <Link to={pageHref(page - 1)}>
                    <Button variant="outline" size="sm">
                      <MdChevronLeft />
                      Previous
                    </Button>
                  </Link>
                )}
                <p className="px-1 text-xs text-ink-text-secondary">
                  Page {page} of {totalPages}
                </p>
                {page >= totalPages ? (
                  <Button variant="outline" size="sm" disabled>
                    Next
                    <MdChevronRight />
                  </Button>
                ) : (
                  <Link to={pageHref(page + 1)}>
                    <Button variant="outline" size="sm">
                      Next
                      <MdChevronRight />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </>
        )}
      </Card>

      <Dialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this session?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-ink-text-secondary">
            This stops {cancelTarget?.name} now and marks the session as canceled. This can&apos;t be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              Keep Session
            </Button>
            <Button
              variant="danger"
              disabled={cancelFetcher.state !== 'idle'}
              onClick={() => {
                if (!cancelTarget) {
                  return;
                }
                cancelFetcher.submit(
                  { intent: 'endBatch' },
                  { method: 'post', action: `/api/batches/${cancelTarget.id}`, encType: 'application/json' },
                );
                setCancelTarget(null);
              }}
            >
              {cancelFetcher.state !== 'idle' ? 'Canceling…' : 'Cancel Session'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
