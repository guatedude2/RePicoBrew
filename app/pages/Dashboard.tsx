import { Link, useLoaderData, useRouteLoaderData } from 'react-router';
import { useEffect, useState, type FC } from 'react';
import { GiHops } from 'react-icons/gi';
import { IoIosBeer } from 'react-icons/io';
import { MdAdd, MdChevronRight, MdDevicesOther, MdScience, MdWarning } from 'react-icons/md';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { ACCENT, StatCard } from '~/components/ui/StatCard';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip';
import { BatchPhase } from '~/types';
import { phaseAccent, phaseLabel } from '~/utils/batch-phase';
import { useServerSideEvent } from '~/utils/sse';

type SessionUpdate = {
  sessionId: number;
  step: string;
  wort: number;
  therm: number;
  timeLeft: number;
};

const formatDate = (date: Date | string) =>
  new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export const Dashboard: FC = () => {
  const { ongoingBrews, fermentingCount, recentBatches } =
    useLoaderData<typeof import('~/routes/_admin.dashboard').loader>();
  const adminData = useRouteLoaderData<typeof import('~/routes/_admin').loader>('routes/_admin');
  const userName = adminData?.session?.name;
  const deviceStatus = adminData?.deviceStatus ?? { online: 0, total: 0 };

  const [greeting, setGreeting] = useState('Welcome back');
  const [today, setToday] = useState('');
  useEffect(() => {
    const now = new Date();
    const hour = now.getHours();
    if (hour < 12) {
      setGreeting('Good morning');
    } else if (hour < 18) {
      setGreeting('Good afternoon');
    } else {
      setGreeting('Good evening');
    }
    setToday(now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }));
  }, []);

  const [liveBySession, setLiveBySession] = useState<Record<number, SessionUpdate>>({});
  useServerSideEvent<SessionUpdate>('session-update', (data) => {
    setLiveBySession((prev) => ({ ...prev, [data.sessionId]: data }));
  });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[26px] font-bold tracking-[-0.3px]">
            {greeting}
            {userName ? `, ${userName}` : ''}
          </p>
          <p className="mt-1 text-sm text-ink-text-dim">{today}</p>
        </div>
        <div className="flex gap-2.5">
          <Link to="/recipes">
            <Button variant="outline" size="sm">
              <IoIosBeer />
              View Recipes
            </Button>
          </Link>
          <Link to="/sessions/new">
            <Button variant="brand" size="sm">
              <MdAdd />
              Start a Brew
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 min-[380px]:grid-cols-2 min-[1200px]:grid-cols-3">
        <StatCard
          label="Active Sessions"
          value={String(ongoingBrews.length)}
          sub={
            ongoingBrews[0]
              ? `${ongoingBrews[0].name} ${phaseLabel(ongoingBrews[0].phase).toLowerCase()}`
              : 'No brews running'
          }
          icon={GiHops}
          accent={ACCENT.brand}
        />
        <StatCard
          label="Devices Online"
          value={`${deviceStatus.online}/${deviceStatus.total}`}
          sub={`${deviceStatus.total} device${deviceStatus.total === 1 ? '' : 's'} registered`}
          icon={MdDevicesOther}
          accent={ACCENT.success}
        />
        <StatCard
          label="Fermentation"
          value={String(fermentingCount)}
          sub={fermentingCount > 0 ? 'Tracking gravity & temp' : 'None tracking'}
          icon={MdScience}
          accent={ACCENT.info}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-[18px] min-[960px]:grid-cols-[1.7fr_1fr]">
        <Card className="gap-0 p-1.5">
          <p className="px-4 pb-2 pt-3.5 text-[13px] font-bold uppercase tracking-[0.5px] text-ink-text-muted">
            Ongoing Brews
          </p>
          {ongoingBrews.length === 0 ? (
            <div className="px-4 pb-[18px]">
              <p className="text-sm text-ink-text-faint">No active brews right now.</p>
            </div>
          ) : (
            ongoingBrews.map((batch) => {
              const live = batch.session ? liveBySession[batch.session.id] : undefined;
              const statusText =
                batch.phase === BatchPhase.CARBONATING
                  ? batch.carbMethod ?? 'Carbonating'
                  : live?.step ?? batch.session?.statusText ?? phaseLabel(batch.phase);
              return (
                <Link key={batch.id} to={`/sessions/${batch.session?.id ?? ''}`} className="text-inherit no-underline">
                  <div className="flex flex-wrap items-center justify-between gap-3.5 border-t border-ink-divider px-4 py-3.5">
                    <div className="flex min-w-0 flex-1 items-center gap-3.5">
                      <div
                        className="flex size-10 flex-none items-center justify-center rounded-[10px]"
                        style={{ backgroundColor: `oklch(${phaseAccent(batch.phase)} / 0.15)` }}
                      >
                        <GiHops className="size-5" style={{ color: `oklch(${phaseAccent(batch.phase)})` }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-bold">{batch.name}</p>
                        <div className="mt-0.5 flex items-center gap-2">
                          <div
                            className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                            style={{
                              backgroundColor: `oklch(${phaseAccent(batch.phase)} / 0.15)`,
                              color: `oklch(${phaseAccent(batch.phase)})`,
                            }}
                          >
                            <span
                              className="size-1.5 shrink-0 animate-[pulse-dot_1.6s_infinite] rounded-full"
                              style={{ backgroundColor: `oklch(${phaseAccent(batch.phase)})` }}
                            />
                            <span>{phaseLabel(batch.phase)}</span>
                          </div>
                          <p className="truncate text-xs text-ink-text-faint">{statusText}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-none items-center gap-[22px]">
                      {batch.needsAttention && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex">
                              <MdWarning className="size-[15px] text-orange-400" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Needs your input to continue</TooltipContent>
                        </Tooltip>
                      )}
                      <div className="text-right">
                        <p className="text-[11px] text-ink-text-faint">Progress</p>
                        <p className="font-mono text-xl font-bold text-brand-500">{batch.progress}%</p>
                      </div>
                      <MdChevronRight className="size-4 text-ink-text-faint" />
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-3.5 flex items-center justify-between">
            <p className="text-sm font-bold">Recent Sessions</p>
            <Link to="/sessions">
              <p className="cursor-pointer text-xs text-brand-500">View all</p>
            </Link>
          </div>
          {recentBatches.length === 0 ? (
            <p className="text-[13px] text-ink-text-faint">No completed sessions yet</p>
          ) : (
            recentBatches.map((batch) => (
              <Link key={batch.id} to="/sessions" className="text-inherit no-underline">
                <div className="flex items-center gap-3 border-t border-ink-divider py-2.5">
                  <div className="flex size-8 flex-none items-center justify-center rounded-[7px] bg-ink-bg">
                    <IoIosBeer className="size-[15px] text-ink-text-muted" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{batch.name}</p>
                    <p className="text-[11px] text-ink-text-faint">{formatDate(batch.updatedAt)}</p>
                  </div>
                  <p
                    className={`text-[11px] font-bold ${
                      batch.phase === BatchPhase.CANCELED ? 'text-danger-500' : 'text-success-500'
                    }`}
                  >
                    {phaseLabel(batch.phase)}
                  </p>
                </div>
              </Link>
            ))
          )}
        </Card>
      </div>
    </>
  );
};
