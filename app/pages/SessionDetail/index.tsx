import { useFetcher, useNavigate, useRevalidator, useRouteLoaderData } from 'react-router';
import { useEffect, useMemo, useRef, useState, type FC, type ReactNode } from 'react';
import {
  MdArrowBack,
  MdAutoAwesome,
  MdCheck,
  MdExpandMore,
  MdFullscreen,
  MdFullscreenExit,
  MdScience,
  MdSignalWifi0Bar,
  MdSignalWifi1Bar,
  MdSignalWifi2Bar,
  MdSignalWifi3Bar,
  MdSignalWifiOff,
  MdThermostat,
  MdWifi,
  MdTimer,
} from 'react-icons/md';
import type { IconType } from 'react-icons';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Select } from '~/components/ui/select';
import { Spinner } from '~/components/ui/spinner';
import { BrewingAnimation, Phase } from '~/components/BrewingAnimation/BrewingAnimation';
import { Chart } from '~/components/charts/Chart.client';
import { ClientOnly } from 'remix-utils/client-only';
import type { loader as sessionDetailLoader } from '~/routes/_admin.sessions.$id';
import { ACCENT, StatCard } from '~/components/ui/StatCard';
import { cn } from '~/lib/utils';
import { BatchPhase } from '~/types';
import { batchOverallProgress, phaseAccent, phaseLabel } from '~/utils/batch-phase';
import { phaseForStep } from '~/utils/brew-step-phase';
import { formatAbv, formatIbu } from '~/utils/brew-stats';
import { useChartZoom } from '~/utils/chart-zoom';
import { postEventStream } from '~/utils/event-stream';
import { formatRelativeTime } from '~/utils/relative-time';
import { srmSwatchUrl } from '~/utils/srm-swatch';
import { useServerSideEvent } from '~/utils/sse';
import { chartTimeToken, formatDateTime, useTimeFormat } from '~/utils/time-format';
import { CarbonationSection, CarbonationSetupForm, Ring, FERM_RING_COLOR } from './CarbonationSection';
import FermentationChart from '~/pages/Fermentation/components/FermentationChart';

type LoaderData = Awaited<ReturnType<typeof sessionDetailLoader>>;
type SessionDetailData = Omit<LoaderData, 'brewLogs' | 'fermLogs'> & {
  brewLogs: Awaited<LoaderData['brewLogs']>;
  fermLogs: Awaited<LoaderData['fermLogs']>;
  // True while the (large) log history is still streaming in — charts show a loading state instead of "no data".
  logsLoading?: boolean;
};
type AiAdviceRow = SessionDetailData['aiAdvice'][number];

const THERMO_COLOR = '#EAB308';
const WORT_COLOR = '#22C55E';
const MAX_W = '820px';

const fermentationTypeLabel = (t: number | null | undefined) => {
  if (t === 0) {
    return 'Ale';
  }
  if (t === 1) {
    return 'Lager';
  }
  if (t === 2) {
    return 'Advanced/Custom';
  }
  return 'Standard Fermentation';
};

type ApexChartContext = {
  el?: {
    querySelector?: (selector: string) => Element | null;
  };
  w?: {
    globals?: {
      gridWidth?: number;
      minX?: number | null;
      maxX?: number | null;
    };
  };
};

const vesselPhaseForBatch = (batchPhase: string, brewPhase: Phase): Phase => {
  if (batchPhase === BatchPhase.COOLING) {
    return Phase.CHILLING;
  }
  if (batchPhase === BatchPhase.FERMENTING) {
    return Phase.FERMENTING;
  }
  if (
    batchPhase === BatchPhase.BOTTLING ||
    batchPhase === BatchPhase.CARBONATING ||
    batchPhase === BatchPhase.COMPLETED
  ) {
    return Phase.CARBONATING;
  }
  if (batchPhase === BatchPhase.CANCELED) {
    return Phase.PREPARING; // a stopped session shows the idle vessel, not finished beer
  }
  return brewPhase;
};

const carbBadgeForPhase = (phase: string) => {
  if (phase === BatchPhase.CARBONATING) {
    return 'IN PROGRESS';
  }
  if (phase === BatchPhase.COMPLETED) {
    return 'DONE';
  }
  return 'NOT STARTED';
};

const activeSectionKeyForPhase = (phase: string) => {
  if (phase === BatchPhase.BREWING) {
    return 'brew';
  }
  if (phase === BatchPhase.COOLING) {
    return 'cool';
  }
  if (phase === BatchPhase.FERMENTING) {
    return 'ferm';
  }
  if (phase === BatchPhase.BOTTLING) {
    return 'bottle';
  }
  if (phase === BatchPhase.CARBONATING) {
    return 'carb';
  }
  return null;
};

const phaseTitle = (p: BatchPhase) => {
  if (p === BatchPhase.CARBONATING) {
    return 'Carbonation';
  }
  if (p === BatchPhase.FERMENTING) {
    return 'Fermentation';
  }
  return p;
};

const tiltAvailability = (device: { inUse?: boolean; online?: boolean }) => {
  if (device.inUse) {
    return 'in use';
  }
  if (!device.online) {
    return 'offline';
  }
  return null;
};

const stepperSwatch = (done: boolean, active: boolean) => {
  if (done) {
    return { bg: 'bg-success-100', color: 'text-success-500', border: 'border-success-500' };
  }
  if (active) {
    return { bg: 'bg-brand-500', color: 'text-ink-on-brand', border: 'border-brand-500' };
  }
  return { bg: 'bg-ink-card', color: 'text-ink-text-faint', border: 'border-ink-border-strong' };
};

// 5475 -> "1h 31m 15s", 915 -> "15m 15s", 45 -> "45s" — hours only once there's at least one.
const formatCountdown = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
};

// Same idea as formatCountdown, but with a days tier on top for a fermentation countdown that can
// span a week or more: 100000 -> "1d 3h", 5475 -> "1h 31m", 915 -> "15m 15s", 45 -> "45s" — one
// step coarser than the leading unit at each tier rather than always drilling down to seconds, so
// a multi-day countdown doesn't show a jittery seconds digit the whole time.
const formatFermCountdown = (totalSeconds: number) => {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
};

const formatDuration = (start: Date | string) => {
  const hours = Math.floor((Date.now() - new Date(start).getTime()) / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  return days > 0 ? `${days}d ${hours % 24}h` : `${hours}h`;
};

// BLE RSSI (dBm, more negative = weaker) mapped onto a Wi-Fi-style bar icon. Thresholds are rough
// (BLE signal is noisy — a Tilt in the same room routinely swings 10-15 dBm reading to reading),
// not a precise distance measurement.
function fermSignalIndicator(rssi: number | undefined, hasEverReported: boolean, isStale: boolean) {
  if (!hasEverReported || isStale) {
    return { Icon: MdSignalWifiOff, label: 'No signal' };
  }
  if (rssi === undefined) {
    return { Icon: MdSignalWifi0Bar, label: 'No bars (low signal)' };
  }
  if (rssi >= -60) {
    return { Icon: MdSignalWifi3Bar, label: 'Full signal' };
  }
  if (rssi >= -75) {
    return { Icon: MdSignalWifi2Bar, label: '2 bars' };
  }
  if (rssi >= -90) {
    return { Icon: MdSignalWifi1Bar, label: '1 bar' };
  }
  return { Icon: MdSignalWifi0Bar, label: 'No bars (low signal)' };
}

const PHASES: BatchPhase[] = [
  BatchPhase.BREWING,
  BatchPhase.COOLING,
  BatchPhase.FERMENTING,
  BatchPhase.BOTTLING,
  BatchPhase.CARBONATING,
  BatchPhase.COMPLETED,
];
// The phases a batch actually cycles through before Completed — used to reorder the section cards
// so whichever one is active surfaces first, wrapping the others around it.
const LIVE_PHASE_COUNT = PHASES.length - 1;

// Greedy interval packing: assigns each marker the first row whose last-placed label doesn't
// overlap it, so labels sit side by side in one row when there's room and only stack into extra
// rows where they'd otherwise collide.
function computeStepLabelRows(markers: Array<{ x: number; label: string }>, pxPerMs: number, minX: number) {
  const CHAR_WIDTH = 5.5;
  const LABEL_PADDING = 12;
  const ROW_GAP_PX = 6;
  const rowEnds: number[] = [];
  return markers.map((m) => {
    const centerPx = (m.x - minX) * pxPerMs;
    const halfWidth = (m.label.length * CHAR_WIDTH + LABEL_PADDING) / 2;
    const startPx = centerPx - halfWidth;
    const endPx = centerPx + halfWidth;
    let row = rowEnds.findIndex((end) => startPx > end + ROW_GAP_PX);
    if (row === -1) {
      row = rowEnds.length;
      rowEnds.push(endPx);
    } else {
      rowEnds[row] = endPx;
    }
    return row;
  });
}

const SectionHeader: FC<{
  title: string;
  badge: string;
  badgeAccent: string;
  expanded: boolean;
  onToggle: () => void;
  right?: ReactNode;
}> = ({ title, badge, badgeAccent, expanded, onToggle, right }) => (
  <div className="flex w-full items-center justify-between gap-3">
    <button type="button" onClick={onToggle} className="flex flex-1 items-center gap-2.5">
      <p className="text-base font-bold">{title}</p>
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-bold"
        style={{ backgroundColor: `oklch(${badgeAccent} / 0.18)`, color: `oklch(${badgeAccent})` }}
      >
        {badge}
      </span>
    </button>
    {right}
    <button type="button" onClick={onToggle}>
      <MdExpandMore
        className={cn('size-5 text-ink-text-faint transition-transform duration-200', expanded && 'rotate-180')}
      />
    </button>
  </div>
);

const ToolbarIconButton: FC<{ icon: IconType; onClick?: () => void; label: string }> = ({
  icon: Icon,
  onClick,
  label,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className="flex h-7 w-8 items-center justify-center rounded-md border border-ink-border text-ink-text-secondary"
  >
    <Icon className="size-3.5" />
  </button>
);

// The "current stage" telemetry cards (Brewing/Fermenting) each embed one of these — shows the
// latest AI advice for that phase and, only while it's the batch's active phase, an Ask AI button.
const AiAdviceBlock: FC<{
  batchId: number;
  batchName: string;
  phase: BatchPhase;
  latest: AiAdviceRow | undefined;
  canAsk: boolean;
}> = ({ batchId, batchName, phase, latest, canAsk }) => {
  const revalidator = useRevalidator();
  const [isPending, setIsPending] = useState(false);
  const [streamed, setStreamed] = useState('');
  const [error, setError] = useState<string | null>(null);

  const askAi = async () => {
    setIsPending(true);
    setStreamed('');
    setError(null);
    try {
      await postEventStream(`/api/batches/${batchId}/ask-ai`, {}, (event, payload) => {
        const data = payload as { text?: string; error?: string };
        if (event === 'delta' && data.text) {
          setStreamed((prev) => prev + data.text);
        } else if (event === 'error') {
          setError(data.error ?? 'The AI request failed.');
        }
      });
      await revalidator.revalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The AI request failed.');
    } finally {
      setIsPending(false);
      setStreamed('');
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-ink-divider bg-ink-bg p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.4px] text-ink-text-faint">
          <MdAutoAwesome className="size-3.5 text-brand-500" />
          AI Advice
        </div>
        {canAsk && (
          <Button variant="outline" size="xs" disabled={isPending} onClick={askAi}>
            {isPending && <Spinner />}
            {isPending ? 'Asking…' : 'Ask AI'}
          </Button>
        )}
      </div>
      <span className="w-fit rounded-full border border-ink-divider bg-ink-card px-2 py-[3px] text-[11px] font-semibold text-ink-text-secondary">
        Session: {batchName}
      </span>
      {error ? <p className="text-xs text-danger-500">{error}</p> : null}
      {isPending && streamed ? <p className="text-[13px] text-ink-text-secondary">{streamed}</p> : null}
      {isPending && !streamed ? (
        <p className="flex items-center gap-2 text-[13px] text-ink-text-faint">
          <Spinner />
          Reading the latest readings…
        </p>
      ) : null}
      {!isPending && latest ? (
        <>
          <p className="text-[13px] text-ink-text-secondary">{latest.content}</p>
          <p className="text-[11px] text-ink-text-faintest">
            {latest.step ? `${latest.step} · ` : ''}
            {formatRelativeTime(latest.createdAt)}
          </p>
        </>
      ) : null}
      {!isPending && !latest ? (
        <p className="text-[13px] text-ink-text-faint">
          {canAsk ? 'No advice yet — click Ask AI or check back soon.' : `No advice was generated during ${phase}.`}
        </p>
      ) : null}
    </div>
  );
};

export const SessionDetail: FC<SessionDetailData> = ({
  batch,
  brewSession,
  fermSession,
  brewLogs,
  fermLogs,
  logsLoading = false,
  tiltDevices,
  aiAdvice,
  brewErrors,
}) => {
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const endFetcher = useFetcher();
  const startTrackingFetcher = useFetcher();
  // Batch.name is a one-time snapshot of the recipe's name taken when the batch was created
  // (see BatchRepository.createBatch) — it goes stale the moment the recipe is renamed. Show the
  // recipe's current name everywhere, falling back to the snapshot only if the recipe was deleted.
  const displayName = batch.recipe?.name ?? batch.name;
  const [endModalOpen, setEndModalOpen] = useState(false);
  const [skipFermentModalOpen, setSkipFermentModalOpen] = useState(false);
  const [selectedTiltId, setSelectedTiltId] = useState(batch.fermentDeviceId ? String(batch.fermentDeviceId) : '');
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!fullscreen) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fullscreen]);

  // Keep in-app state synced when the browser's own fullscreen exits (Escape, F11, etc.) —
  // but only once we've actually observed it engage. requestFullscreen() can silently fail
  // (no user-gesture, sandboxed context, policy denial); if it never engaged, fullscreenElement
  // was already null and this must not immediately undo the in-app toggle.
  const nativeFullscreenEngaged = useRef(false);
  useEffect(() => {
    const onFullscreenChange = () => {
      if (document.fullscreenElement) {
        nativeFullscreenEngaged.current = true;
      } else if (nativeFullscreenEngaged.current) {
        nativeFullscreenEngaged.current = false;
        setFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!fullscreen) {
      setFullscreen(true);
      document.documentElement.requestFullscreen?.().catch(() => undefined);
    } else {
      setFullscreen(false);
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => undefined);
      }
    }
  };

  const currentIdx = PHASES.indexOf(batch.phase as BatchPhase);
  const isLive = batch.phase !== BatchPhase.COMPLETED && batch.phase !== BatchPhase.CANCELED;

  // Once a phase is reached (including phases already passed), its section counts as "done"; the
  // one matching batch.phase exactly is the currently active one.
  const phaseReached = (p: BatchPhase) => currentIdx !== -1 && PHASES.indexOf(p) <= currentIdx;
  const sectionBadge = (p: BatchPhase): 'LIVE' | 'DONE' | 'NOT STARTED' => {
    if (currentIdx === -1) {
      return 'NOT STARTED';
    }
    const idx = PHASES.indexOf(p);
    if (idx === currentIdx) {
      return 'LIVE';
    }
    return idx < currentIdx ? 'DONE' : 'NOT STARTED';
  };

  const [brewExpanded, setBrewExpanded] = useState(
    batch.phase === BatchPhase.BREWING || batch.phase === BatchPhase.COMPLETED,
  );
  const [coolExpanded, setCoolExpanded] = useState(batch.phase === BatchPhase.COOLING);
  const [fermExpanded, setFermExpanded] = useState(
    batch.phase === BatchPhase.FERMENTING || batch.phase === BatchPhase.COMPLETED,
  );
  const [bottleExpanded, setBottleExpanded] = useState(batch.phase === BatchPhase.BOTTLING);
  const [carbExpanded, setCarbExpanded] = useState(
    batch.phase === BatchPhase.CARBONATING || batch.phase === BatchPhase.COMPLETED,
  );

  const fermSectionRef = useRef<HTMLDivElement>(null);
  const scrollToFermentation = () => {
    setFermExpanded(true);
    setTimeout(() => fermSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  // Moves the batch out of Brewing once the user confirms the wort has cooled and fermentation
  // has actually begun — this is a manual, physical step the device can't detect on its own.
  const startFermentationFetcher = useFetcher();
  const startFermentation = () => {
    startFermentationFetcher.submit(
      { intent: 'startFermentation' },
      { method: 'post', action: `/api/batches/${batch.id}`, encType: 'application/json' },
    );
    scrollToFermentation();
  };

  // Live brew telemetry
  // `receivedAt` is when this reading arrived (browser clock), so the countdown below can keep
  // ticking between readings — the Pico only reports about every 25 seconds.
  const [liveBrew, setLiveBrew] = useState<{
    step: string;
    wort: number;
    therm: number;
    timeLeft: number;
    receivedAt: number;
  } | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!liveBrew) {
      return;
    }
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [liveBrew]);
  const brewSecondsLeft = liveBrew
    ? Math.max(0, liveBrew.timeLeft - Math.max(0, Math.floor((nowMs - liveBrew.receivedAt) / 1000)))
    : 0;
  // Readings that have arrived over SSE since the last loader revalidation — plotted immediately
  // so the chart grows in real time instead of waiting for a page refresh to pick them up.
  const [liveChartPoints, setLiveChartPoints] = useState<{
    wort: Array<{ x: number; y: number }>;
    therm: Array<{ x: number; y: number }>;
  }>({ wort: [], therm: [] });
  // Step changes seen over SSE since the last loader refresh, so the chart marks a new step as it starts
  // instead of only after a page reload. lastLoggedStepRef holds the last step already in the saved log.
  const [liveStepMarkers, setLiveStepMarkers] = useState<Array<{ x: number; label: string }>>([]);
  const lastLoggedStepRef = useRef<string | null>(null);
  useServerSideEvent<{ sessionId: number; step: string; wort: number; therm: number; timeLeft: number }>(
    'session-update',
    (data) => {
      if (brewSession && data.sessionId === brewSession.id) {
        const t = Date.now();
        setLiveBrew({ ...data, receivedAt: t });
        setLiveChartPoints((prev) => ({
          wort: [...prev.wort, { x: t, y: data.wort }],
          therm: [...prev.therm, { x: t, y: data.therm }],
        }));
        setLiveStepMarkers((prev) => {
          const lastStep = prev.length > 0 ? prev[prev.length - 1].label : lastLoggedStepRef.current;
          return data.step && data.step !== lastStep ? [...prev, { x: t, label: data.step }] : prev;
        });
      }
    },
  );
  // Errors the Pico reported for this session, from the loader plus any that arrive live.
  const [liveErrors, setLiveErrors] = useState(brewErrors);
  useEffect(() => setLiveErrors(brewErrors), [brewErrors]);
  useServerSideEvent<{
    sessionId: number | null;
    code: number;
    summary: string;
    cause: string;
    action: string;
  }>('session-error', (data) => {
    if (brewSession && data.sessionId === brewSession.id) {
      setLiveErrors((prev) => [
        ...prev,
        { time: new Date(), code: data.code, summary: data.summary, cause: data.cause, action: data.action },
      ]);
    }
  });
  // Once brewLogs is refetched, those points are already in it — drop the live-only buffer.
  useEffect(() => {
    setLiveChartPoints({ wort: [], therm: [] });
    setLiveStepMarkers([]);
  }, [brewLogs]);

  // Live fermentation telemetry (Tilt) — seeded from the last logged reading (if any) so a fresh
  // page load shows real numbers immediately instead of flashing "no signal" before the next live
  // update arrives. FERM_STALE_MS is what turns "hasn't reported since the page loaded" into a
  // real signal-loss warning.
  const lastFermLog = fermLogs.length > 0 ? fermLogs[fermLogs.length - 1] : null;
  const initialFermData = lastFermLog
    ? (JSON.parse(lastFermLog.data) as { temp?: number; gravity?: number; rssi?: number })
    : null;
  const [liveFerm, setLiveFerm] = useState<{ gravity: number; temp: number; rssi?: number } | null>(
    initialFermData?.temp !== undefined && initialFermData?.gravity !== undefined
      ? { gravity: initialFermData.gravity, temp: initialFermData.temp, rssi: initialFermData.rssi }
      : null,
  );
  const [lastFermReceivedAt, setLastFermReceivedAt] = useState<number | null>(
    lastFermLog ? new Date(lastFermLog.time).getTime() : null,
  );
  useServerSideEvent<{ sessionId: number; gravity: number; temp: number; rssi?: number }>('tilt-update', (data) => {
    if (fermSession && data.sessionId === fermSession.id) {
      setLiveFerm(data);
      setLastFermReceivedAt(Date.now());
    }
  });
  const FERM_STALE_MS = 3 * 60 * 1000;
  // Also drives the "Total Fermentation Time Left" countdown, hence the 1s tick rather than
  // something coarser that would only suit the staleness check on its own.
  const [fermNowMs, setFermNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!fermSession) {
      return;
    }
    const timer = setInterval(() => setFermNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [fermSession]);
  const fermHasEverReported = lastFermReceivedAt !== null;
  const fermIsStale = fermHasEverReported && fermNowMs - lastFermReceivedAt > FERM_STALE_MS;

  const hasAiKey = Boolean(useRouteLoaderData<typeof import('~/routes/_admin').loader>('routes/_admin')?.hasAiKey);
  const timeFormat = useTimeFormat();
  const [aiAdviceList, setAiAdviceList] = useState<AiAdviceRow[]>(aiAdvice);
  useServerSideEvent<{ batchId: number; advice: AiAdviceRow }>('ai-advice-ready', (data) => {
    if (data.batchId === batch.id) {
      setAiAdviceList((prev) => [data.advice, ...prev]);
    }
  });
  const latestBrewAdvice = aiAdviceList.find((a) => a.phase === BatchPhase.BREWING);
  const latestFermAdvice = aiAdviceList.find((a) => a.phase === BatchPhase.FERMENTING);

  const brewChart = useMemo(() => {
    const wort: Array<{ x: number; y: number }> = [];
    const therm: Array<{ x: number; y: number }> = [];
    const stepMarkers: Array<{ x: number; label: string }> = [];
    let lastStep: string | null = null;
    brewLogs.forEach((log) => {
      try {
        const d = JSON.parse(log.data);
        const t = new Date(log.time).getTime();
        if (typeof d.wort === 'number') {
          wort.push({ x: t, y: d.wort });
        }
        if (typeof d.therm === 'number') {
          therm.push({ x: t, y: d.therm });
        }
        if (typeof d.step === 'string' && d.step && d.step !== lastStep) {
          stepMarkers.push({ x: t, label: d.step });
          lastStep = d.step;
        }
      } catch {
        // skip malformed rows
      }
    });
    return { wort, therm, stepMarkers };
  }, [brewLogs]);
  lastLoggedStepRef.current =
    brewChart.stepMarkers.length > 0 ? brewChart.stepMarkers[brewChart.stepMarkers.length - 1].label : null;
  // Saved markers plus any step changes that arrived live since.
  const stepMarkers = useMemo(
    () => [...brewChart.stepMarkers, ...liveStepMarkers],
    [brewChart.stepMarkers, liveStepMarkers],
  );

  const combinedWort = useMemo(
    () => [...brewChart.wort, ...liveChartPoints.wort],
    [brewChart.wort, liveChartPoints.wort],
  );
  const combinedTherm = useMemo(
    () => [...brewChart.therm, ...liveChartPoints.therm],
    [brewChart.therm, liveChartPoints.therm],
  );

  const zoom = useChartZoom(
    combinedWort.length > 0 ? [combinedWort[0].x, combinedWort[combinedWort.length - 1].x] : null,
  );

  // Step labels lay out in a single row when zoomed in enough to fit side by side, and only stack
  // into extra rows where they'd otherwise collide. The box/grid below reserve room for this many
  // rows statically; onChartScaleChange (below) repositions the rendered label elements directly
  // in the DOM as the user zooms/pans, rather than through React state — ReactApexChart calling
  // updateOptions() in response to a state change interrupts ApexCharts' own drag-to-zoom gesture,
  // even when deferred to the next tick, so this stays entirely outside React's render cycle.
  const STEP_LABEL_ROWS_RESERVED = 6;
  const stepLabelAreaPx = 30 + STEP_LABEL_ROWS_RESERVED * 18 + 10;
  const brewChartBoxHeight = 250 + stepLabelAreaPx;
  const stepLabelBaseline = useRef<{ rectY: number; textY: number } | null>(null);

  const onChartScaleChange = (chartContext: ApexChartContext) => {
    const g = chartContext?.w?.globals;
    if (!g || !g.gridWidth || g.minX == null || g.maxX == null || g.maxX <= g.minX) {
      return;
    }
    const pxPerMs = g.gridWidth / (g.maxX - g.minX);
    const minX = g.minX;
    const rows = computeStepLabelRows(stepMarkers, pxPerMs, minX);

    const group: Element | null | undefined = chartContext?.el?.querySelector?.('.apexcharts-xaxis-annotations');
    if (!group) {
      return;
    }
    const children = group.children;

    if (!stepLabelBaseline.current) {
      const firstRect = children[1];
      const firstText = children[2];
      if (!firstRect || !firstText) {
        return;
      }
      stepLabelBaseline.current = {
        rectY: parseFloat(firstRect.getAttribute('y') || '0'),
        textY: parseFloat(firstText.getAttribute('y') || '0'),
      };
    }
    const { rectY: baseRectY, textY: baseTextY } = stepLabelBaseline.current;

    stepMarkers.forEach((_, i) => {
      const row = Math.min(rows[i] ?? 0, STEP_LABEL_ROWS_RESERVED - 1);
      const line = children[i * 3];
      const rect = children[i * 3 + 1];
      const text = children[i * 3 + 2];
      rect?.setAttribute('y', String(baseRectY + row * 18));
      text?.setAttribute('y', String(baseTextY + row * 18));
      // Extend the marker line down to meet its (possibly stacked) label instead of stopping
      // short at the grid edge with a gap.
      line?.setAttribute('y2', String(baseRectY + row * 18));
    });
  };

  // Until a fresh SSE update arrives, fall back to the last known step/reading (from the
  // session's persisted status and log history) instead of resetting to "Preparing" — otherwise
  // the vessel animation snaps back to the very first stage on every refresh or navigation.
  const lastLoggedStep = stepMarkers.length > 0 ? stepMarkers[stepMarkers.length - 1].label : null;
  const lastLoggedWort = brewChart.wort.length > 0 ? brewChart.wort[brewChart.wort.length - 1].y : null;
  const fallbackStep = brewSession?.statusText ?? lastLoggedStep;

  // Steps already seen this session (a live step that isn't logged yet has just started, so all logged steps
  // are earlier ones; otherwise the current step is the last logged one).
  const stepHistory = stepMarkers.map((marker) => marker.label);
  const currentStep = liveBrew?.step ?? fallbackStep;
  const earlierSteps =
    currentStep && stepHistory[stepHistory.length - 1] === currentStep ? stepHistory.slice(0, -1) : stepHistory;
  const phase = currentStep ? phaseForStep(currentStep, earlierSteps) : Phase.PREPARING;
  const temperature = liveBrew?.wort ?? lastLoggedWort ?? 70;
  // The vessel graphic is one continuous animated illustration for the whole session — it just
  // switches scenes (kettle / chiller / fermenter / bottles) rather than swapping to a different image.
  const vesselPhase = vesselPhaseForBatch(batch.phase, phase);

  const coolingAvailable = phaseReached(BatchPhase.COOLING);
  const fermentationAvailable = phaseReached(BatchPhase.FERMENTING);
  const bottlingAvailable = phaseReached(BatchPhase.BOTTLING);
  const carbAvailable = phaseReached(BatchPhase.CARBONATING);

  const brewBadge = sectionBadge(BatchPhase.BREWING);
  const coolBadge = sectionBadge(BatchPhase.COOLING);
  const fermBadge = sectionBadge(BatchPhase.FERMENTING);
  const bottleBadge = sectionBadge(BatchPhase.BOTTLING);
  const carbBadge = carbBadgeForPhase(batch.phase);

  // Reorder the section cards so whichever is currently active surfaces first.
  const sectionCurrentIdx = currentIdx >= 0 && currentIdx < LIVE_PHASE_COUNT ? currentIdx : 0;
  const isCompletedPhase = batch.phase === BatchPhase.COMPLETED;
  const orderFor = (idx: number) =>
    isCompletedPhase ? idx : (idx - sectionCurrentIdx + LIVE_PHASE_COUNT) % LIVE_PHASE_COUNT;
  const brewOrder = orderFor(0);
  const coolOrder = orderFor(1);
  const fermOrder = orderFor(2);
  const bottleOrder = orderFor(3);
  const carbOrder = orderFor(4);

  // Same formula the Dashboard's ongoing-brews list uses, so both show the same number for a batch.
  const overallProgress = batchOverallProgress(batch);

  const fermMs = (batch.recipe?.fermentDays ?? 7) * 86400000;
  const fermStart = fermSession ? new Date(fermSession.createdAt).getTime() : new Date(batch.updatedAt).getTime();
  const clampPct = (start: number, totalMs: number) =>
    totalMs > 0 ? Math.max(0, Math.min(99, Math.round(((Date.now() - start) / totalMs) * 100))) : 0;

  const fermPercent = clampPct(fermStart, fermMs);
  const fermRemainingMs = Math.max(0, fermStart + fermMs - fermNowMs);
  const fermDays = Math.floor(fermRemainingMs / 86400000);
  const fermHours = Math.floor((fermRemainingMs % 86400000) / 3600000);

  const fermInfoRows = batch.recipe
    ? [
        { label: 'Process', value: fermentationTypeLabel(batch.recipe.fermentationType) },
        ...(batch.recipe.yeastName ? [{ label: 'Yeast', value: batch.recipe.yeastName }] : []),
        { label: 'Fermenting Since', value: formatDateTime(fermStart, timeFormat) },
        ...(batch.recipe.yeastRangeTemp
          ? [{ label: 'Safe Temp Range', value: `${batch.recipe.yeastRangeTemp} °F` }]
          : []),
      ]
    : [];

  const fermentationTimeUp = fermRemainingMs <= 0;

  const startBottling = () =>
    fetcher.submit(JSON.stringify({ intent: 'startBottling' }), {
      method: 'post',
      action: `/api/batches/${batch.id}`,
      encType: 'application/json',
    });

  // Once the recipe's estimated fermentation window has elapsed, moving on is the expected next
  // step; before that, it's cutting fermentation short, so confirm first.
  const handleBottleClick = () => {
    if (fermentationTimeUp) {
      startBottling();
    } else {
      setSkipFermentModalOpen(true);
    }
  };

  const brewingCard = (
    <Card key="brew" className="gap-4 p-[22px]">
      <SectionHeader
        title="Brewing"
        badge={brewBadge}
        badgeAccent={phaseAccent(BatchPhase.BREWING)}
        expanded={brewExpanded}
        onToggle={() => setBrewExpanded((v) => !v)}
      />
      {brewExpanded && brewSession && (
        <div className="flex flex-col gap-4">
          {liveErrors.length > 0 && (
            <div className="flex flex-col gap-2">
              {liveErrors.map((err) => (
                <div
                  key={`${err.code}-${new Date(err.time).getTime()}`}
                  className="rounded-[10px] border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-[13px] text-red-600 dark:text-red-400"
                >
                  <p className="font-bold">
                    Pico error {err.code}: {err.summary}
                  </p>
                  <p className="mt-0.5 text-ink-text-faint">{err.cause}</p>
                  <p className="mt-0.5">{err.action}</p>
                </div>
              ))}
            </div>
          )}
          {batch.phase === BatchPhase.BREWING && liveBrew?.timeLeft ? (
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-[0.4px] text-ink-text-faint">Time Remaining</p>
              <p className="font-mono text-lg font-bold text-brand-500">{formatCountdown(brewSecondsLeft)}</p>
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3.5 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: THERMO_COLOR }} />
              <span>ThermoBlock</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: WORT_COLOR }} />
              <span>Wort</span>
            </div>
          </div>

          {combinedWort.length === 0 && (
            <div className="flex h-[280px] items-center justify-center rounded-[10px] border border-dashed border-ink-divider">
              <p className="flex items-center gap-2 text-[13px] text-ink-text-faint">
                {logsLoading && <Spinner />}
                {logsLoading ? 'Loading readings…' : 'Waiting for first reading...'}
              </p>
            </div>
          )}
          {combinedWort.length > 0 && (
            <div style={{ height: `${brewChartBoxHeight}px` }}>
              <ClientOnly>
                {() => (
                  <Chart
                    type="line"
                    height="100%"
                    series={[
                      { name: 'ThermoBlock', data: combinedTherm.map((p) => [p.x, p.y]) },
                      { name: 'Wort', data: combinedWort.map((p) => [p.x, p.y]) },
                    ]}
                    options={{
                      chart: {
                        background: 'transparent',
                        zoom: { enabled: true, autoScaleYaxis: true },
                        toolbar: {
                          show: true,
                          autoSelected: 'zoom',
                          tools: {
                            download: false,
                            selection: false,
                            zoom: true,
                            zoomin: true,
                            zoomout: true,
                            pan: true,
                            reset: true,
                          },
                        },
                        events: {
                          mounted: (chartContext: ApexChartContext) => onChartScaleChange(chartContext),
                          updated: (chartContext: ApexChartContext) => onChartScaleChange(chartContext),
                          zoomed: (chartContext: ApexChartContext, args: never) => {
                            zoom.events.zoomed(chartContext, args);
                            onChartScaleChange(chartContext);
                          },
                          scrolled: (chartContext: ApexChartContext, args: never) => {
                            zoom.events.scrolled(chartContext, args);
                            onChartScaleChange(chartContext);
                          },
                          beforeResetZoom: zoom.events.beforeResetZoom,
                        },
                      },
                      colors: [THERMO_COLOR, WORT_COLOR],
                      stroke: { width: 2, curve: 'smooth' },
                      dataLabels: { enabled: false },
                      legend: { show: false },
                      xaxis: {
                        type: 'datetime',
                        ...zoom.xaxisRange,
                        labels: {
                          style: { colors: 'oklch(0.6 0.008 260)' },
                          datetimeUTC: false,
                          datetimeFormatter: {
                            hour: chartTimeToken(timeFormat),
                            minute: chartTimeToken(timeFormat),
                            second: chartTimeToken(timeFormat, true),
                          },
                        },
                      },
                      yaxis: {
                        min: 0,
                        title: { text: 'TEMP (°F)', style: { color: 'oklch(0.6 0.008 260)' } },
                        labels: { style: { colors: 'oklch(0.6 0.008 260)' } },
                      },
                      grid: { borderColor: 'oklch(0.24 0.008 260)', padding: { bottom: stepLabelAreaPx } },
                      tooltip: {
                        theme: 'dark',
                        shared: true,
                        x: { format: `MMM d, ${chartTimeToken(timeFormat, true)}` },
                      },
                      annotations: {
                        xaxis: stepMarkers.map((m, i) => ({
                          x: m.x,
                          borderColor: 'oklch(0.32 0.01 260)',
                          label: {
                            text: m.label,
                            orientation: 'horizontal',
                            position: 'bottom',
                            // Initial static stagger for first paint; onChartScaleChange takes
                            // over and repositions these in the DOM once the chart has real geometry.
                            offsetY: 28 + (i % STEP_LABEL_ROWS_RESERVED) * 18,
                            borderColor: 'oklch(0.32 0.01 260)',
                            borderWidth: 1,
                            style: {
                              color: 'oklch(0.75 0.006 260)',
                              background: 'oklch(0.19 0.005 260)',
                              fontSize: '10px',
                              padding: { left: 5, right: 5, top: 2, bottom: 2 },
                            },
                          },
                        })),
                      },
                    }}
                  />
                )}
              </ClientOnly>
            </div>
          )}

          <div className="flex flex-wrap gap-6 text-xs text-ink-text-faint">
            <p>
              Machine <span className="font-semibold text-ink-text">{brewSession.device?.name ?? 'Unknown'}</span>
            </p>
            <p>
              Started <span className="font-semibold text-ink-text">{formatDateTime(batch.createdAt, timeFormat)}</span>
            </p>
            {batch.phase !== BatchPhase.BREWING && batch.completedAt && (
              <p>
                Completed{' '}
                <span className="font-semibold text-ink-text">{formatDateTime(batch.completedAt, timeFormat)}</span>
              </p>
            )}
          </div>

          {hasAiKey && (
            <AiAdviceBlock
              batchId={batch.id}
              batchName={displayName}
              phase={BatchPhase.BREWING}
              latest={latestBrewAdvice}
              canAsk={batch.phase === BatchPhase.BREWING}
            />
          )}
        </div>
      )}
      {brewExpanded && !brewSession && (
        <p className="text-[13px] text-ink-text-faint">No brewing data for this batch.</p>
      )}
    </Card>
  );

  let coolingBody: ReactNode = (
    <p className="py-5 text-center text-[13px] text-ink-text-faint">
      Cooling starts automatically once brewing finishes.
    </p>
  );
  if (coolingAvailable && batch.phase === BatchPhase.COOLING) {
    coolingBody = (
      <div className="flex flex-col gap-2.5 rounded-[10px] border border-brand-500 bg-ink-bg p-4">
        <p className="text-[13px] font-bold">Start Wort Cooling</p>
        <p className="text-[13px] text-ink-text-secondary">
          Let the Brew Keg cool to room temperature — this can take up to 24 hours depending on ambient temperature.
          Once it&apos;s cool to the touch, apply the Fermentation Temperature Decal to the outside of the keg and pitch
          your yeast.{' '}
          <a
            href="/manuals/pico-c-manual"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-brand-500"
          >
            View full instructions
          </a>
        </p>
        <p className="text-xs text-ink-text-faint">
          Once you&apos;re ready to start fermentation, confirm below to move on.
        </p>
        <Button
          variant="brand"
          className="self-start"
          disabled={startFermentationFetcher.state !== 'idle'}
          onClick={startFermentation}
        >
          {startFermentationFetcher.state !== 'idle' ? 'Starting…' : 'Start Fermentation'}
        </Button>
      </div>
    );
  } else if (coolingAvailable) {
    coolingBody = (
      <p className="py-5 text-center text-[13px] text-ink-text-faint">
        Wort cooled — fermentation started {formatDateTime(fermStart, timeFormat)}.
      </p>
    );
  }

  const coolingCard = (
    <Card key="cool" className="gap-4 p-[22px]">
      <SectionHeader
        title="Cooling"
        badge={coolBadge}
        badgeAccent={phaseAccent(BatchPhase.COOLING)}
        expanded={coolExpanded}
        onToggle={() => setCoolExpanded((v) => !v)}
      />
      {coolExpanded ? coolingBody : null}
    </Card>
  );

  let fermentationBody: ReactNode = (
    <p className="py-5 text-center text-[13px] text-ink-text-faint">
      Fermentation tracking starts once cooling is done and a Tilt is dropped in the fermenter.
    </p>
  );
  const fermSignal = fermSignalIndicator(liveFerm?.rssi, fermHasEverReported, fermIsStale);
  if (fermentationAvailable && fermSession) {
    fermentationBody = (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-text-secondary">
          {fermSession.device?.name ?? 'Tilt'}
          <fermSignal.Icon
            className={cn('size-4', fermIsStale || !fermHasEverReported ? 'text-danger-500' : 'text-ink-text-faint')}
            title={fermSignal.label}
          />
        </div>
        {(!fermHasEverReported || fermIsStale) && (
          <div
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3.5 py-2.5',
              fermIsStale ? 'border-danger-500 bg-danger-100' : 'border-ink-divider bg-ink-bg',
            )}
          >
            <MdWifi className={cn('size-4', fermIsStale ? 'text-danger-500' : 'text-ink-text-faint')} />
            <p className={cn('text-[13px] font-semibold', fermIsStale ? 'text-danger-500' : 'text-ink-text-faint')}>
              {fermIsStale
                ? `No signal from ${fermSession.device?.name ?? 'Tilt'}`
                : `Waiting for ${fermSession.device?.name ?? 'Tilt'} measurement...`}
            </p>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <StatCard
            label="Specific Gravity"
            value={liveFerm?.gravity?.toFixed(3) ?? '-.---'}
            sub="Current reading"
            icon={MdScience}
            accent={ACCENT.purple}
          />
          <StatCard
            label="Temperature"
            value={liveFerm?.temp?.toFixed(1) ?? '--'}
            unit="°F"
            sub="Fermentation temp"
            icon={MdThermostat}
            accent={ACCENT.danger}
          />
          <StatCard
            label="Time Remaining"
            value={fermentationTimeUp ? 'Time up' : formatFermCountdown(Math.floor(fermRemainingMs / 1000))}
            sub={`${formatDuration(fermSession.createdAt)} elapsed of ${batch.recipe?.fermentDays ?? 7}d total`}
            icon={MdTimer}
            accent={ACCENT.brand}
          />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-end gap-3.5 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="h-0.5 w-2.5 bg-info-500" />
              <span>Gravity</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-0.5 w-2.5 bg-brand-500" />
              <span>Temp</span>
            </div>
          </div>
          <FermentationChart sessionId={fermSession.id} />
        </div>
        {hasAiKey && (
          <AiAdviceBlock
            batchId={batch.id}
            batchName={displayName}
            phase={BatchPhase.FERMENTING}
            latest={latestFermAdvice}
            canAsk={batch.phase === BatchPhase.FERMENTING}
          />
        )}
        {batch.phase === BatchPhase.FERMENTING && (
          <Button
            variant={fermentationTimeUp ? 'brand' : 'link'}
            size={fermentationTimeUp ? 'default' : 'sm'}
            disabled={fetcher.state !== 'idle'}
            onClick={handleBottleClick}
          >
            {fetcher.state !== 'idle' ? 'Working…' : fermentationTimeUp ? 'Start Bottling' : 'Skip Fermentation'}
          </Button>
        )}
      </div>
    );
  } else if (fermentationAvailable) {
    fermentationBody = (
      <div className="flex flex-col gap-4">
        {batch.phase === BatchPhase.FERMENTING && fermPercent < 20 && tiltDevices.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <Select
                placeholder="Select a Tilt"
                value={selectedTiltId}
                onChange={(e) => setSelectedTiltId(e.target.value)}
                className="h-8 w-auto min-w-[180px] text-xs"
              >
                {tiltDevices.map((d) => {
                  const label = `Tilt · ${d.color || d.name}`;
                  const unavailable = tiltAvailability(d);
                  return (
                    <option key={d.id} value={d.id} disabled={!!unavailable}>
                      {unavailable ? `${label} - ${unavailable}` : label}
                    </option>
                  );
                })}
              </Select>
              <Button
                variant="outline"
                size="sm"
                disabled={!selectedTiltId || startTrackingFetcher.state !== 'idle'}
                onClick={() =>
                  startTrackingFetcher.submit(
                    { action: 'start', deviceId: selectedTiltId, batchId: String(batch.id) },
                    { method: 'post', action: '/api/fermentation/session', encType: 'application/json' },
                  )
                }
              >
                {startTrackingFetcher.state !== 'idle' ? 'Starting…' : 'Start Tracking'}
              </Button>
            </div>
            {startTrackingFetcher.data?.error && (
              <p className="text-xs text-danger-500">{startTrackingFetcher.data.error}</p>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.5px] text-ink-text-faint">
              Total Fermentation Time Left
            </p>
            <p className="mt-1 font-mono text-[38px] font-light">
              {formatFermCountdown(Math.floor(fermRemainingMs / 1000))}
            </p>
          </div>
          <Ring percent={fermPercent} label="Complete" color={FERM_RING_COLOR} />
        </div>
        <div className="flex flex-col overflow-hidden rounded-[10px] border border-ink-divider">
          {fermInfoRows.map((row) => (
            <div
              key={row.label}
              className="flex justify-between border-t border-ink-divider bg-ink-bg px-4 py-3 text-[13px] first:border-t-0"
            >
              <p className="text-ink-text-faint">{row.label}</p>
              <p className="text-ink-text">{row.value}</p>
            </div>
          ))}
        </div>
        {hasAiKey && (
          <AiAdviceBlock
            batchId={batch.id}
            batchName={displayName}
            phase={BatchPhase.FERMENTING}
            latest={latestFermAdvice}
            canAsk={batch.phase === BatchPhase.FERMENTING}
          />
        )}
        {batch.phase === BatchPhase.FERMENTING && (
          <Button
            variant={fermentationTimeUp ? 'brand' : 'link'}
            size={fermentationTimeUp ? 'default' : 'sm'}
            disabled={fetcher.state !== 'idle'}
            onClick={handleBottleClick}
          >
            {fetcher.state !== 'idle' ? 'Working…' : fermentationTimeUp ? 'Start Bottling' : 'Skip Fermentation'}
          </Button>
        )}
      </div>
    );
  }

  const fermentationCard = (
    <Card key="ferm" ref={fermSectionRef} className="gap-[18px] p-[22px]">
      <SectionHeader
        title="Fermentation"
        badge={fermBadge}
        badgeAccent={phaseAccent(BatchPhase.FERMENTING)}
        expanded={fermExpanded}
        onToggle={() => setFermExpanded((v) => !v)}
      />
      {fermExpanded ? fermentationBody : null}
    </Card>
  );

  let bottlingBody: ReactNode = (
    <p className="py-5 text-center text-[13px] text-ink-text-faint">Bottling starts once fermentation is done.</p>
  );
  if (bottlingAvailable && batch.phase === BatchPhase.BOTTLING) {
    bottlingBody = (
      <div className="flex flex-col gap-3.5">
        <p className="text-[13px] text-ink-text-secondary">
          Rack the beer into bottles (or a keg), then choose how you&apos;re carbonating and start the countdown.
        </p>
        <CarbonationSetupForm
          batchId={batch.id}
          initialMethod={batch.carbMethod}
          initialDuration={batch.carbDuration}
        />
      </div>
    );
  } else if (bottlingAvailable) {
    const carbState = batch.phase === BatchPhase.COMPLETED ? 'complete' : 'in progress';
    bottlingBody = (
      <p className="py-5 text-center text-[13px] text-ink-text-faint">Bottled — carbonation {carbState}.</p>
    );
  }

  const bottlingCard = (
    <Card key="bottle" className="gap-4 p-[22px]">
      <SectionHeader
        title="Bottling"
        badge={bottleBadge}
        badgeAccent={phaseAccent(BatchPhase.BOTTLING)}
        expanded={bottleExpanded}
        onToggle={() => setBottleExpanded((v) => !v)}
      />
      {bottleExpanded ? bottlingBody : null}
    </Card>
  );

  const carbonationCard = (
    <Card key="carb" className="gap-4 p-[22px]">
      <SectionHeader
        title="Carbonation"
        badge={carbBadge}
        badgeAccent={phaseAccent(BatchPhase.CARBONATING)}
        expanded={carbExpanded}
        onToggle={() => setCarbExpanded((v) => !v)}
      />
      {carbExpanded &&
        (carbAvailable ? (
          <CarbonationSection
            data={{
              batchId: batch.id,
              carbMethod: batch.carbMethod,
              carbDuration: batch.carbDuration,
              carbUnit: batch.carbUnit,
              carbStartedAt: batch.carbStartedAt,
              carbStatus: batch.carbStatus,
              carbExtendMinutes: batch.carbExtendMinutes,
              isCompleted: batch.phase === BatchPhase.COMPLETED,
            }}
          />
        ) : (
          <p className="py-5 text-center text-[13px] text-ink-text-faint">
            Carbonation starts once you&apos;ve bottled and picked a method. There&apos;s no sensor tracking here — just
            a countdown.
          </p>
        ))}
    </Card>
  );

  const orderedSections = [
    { key: 'brew', order: brewOrder, node: brewingCard },
    { key: 'cool', order: coolOrder, node: coolingCard },
    { key: 'ferm', order: fermOrder, node: fermentationCard },
    { key: 'bottle', order: bottleOrder, node: bottlingCard },
    { key: 'carb', order: carbOrder, node: carbonationCard },
  ].sort((a, b) => a.order - b.order);

  // In fullscreen, only the stage matching the batch's current phase stays visible.
  const activeSectionKey = activeSectionKeyForPhase(batch.phase);
  const visibleSections =
    fullscreen && activeSectionKey ? orderedSections.filter((s) => s.key === activeSectionKey) : orderedSections;

  const content = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {!fullscreen && (
            <button
              type="button"
              onClick={() => navigate('/sessions')}
              className="flex size-8 items-center justify-center rounded-[7px] border border-ink-card-border bg-ink-card"
            >
              <MdArrowBack className="size-[15px]" />
            </button>
          )}
          <div>
            <p className="text-lg font-bold">{displayName}</p>
            <p className="text-xs text-ink-text-faint">
              {brewSession?.device?.name ?? fermSession?.device?.name ?? 'Unknown device'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{
              backgroundColor: `oklch(${phaseAccent(batch.phase)} / 0.15)`,
              color: `oklch(${phaseAccent(batch.phase)})`,
            }}
          >
            {isLive && (
              <span
                className="size-1.5 animate-[pulse-dot_1.6s_infinite] rounded-full"
                style={{ backgroundColor: `oklch(${phaseAccent(batch.phase)})` }}
              />
            )}
            <span>{phaseLabel(batch.phase)}</span>
          </div>
          {batch.phase !== BatchPhase.COMPLETED && batch.phase !== BatchPhase.CANCELED && (
            <Button variant="danger" size="sm" onClick={() => setEndModalOpen(true)}>
              End Session
            </Button>
          )}
          <ToolbarIconButton
            icon={fullscreen ? MdFullscreenExit : MdFullscreen}
            label={fullscreen ? 'Exit full screen' : 'Full screen'}
            onClick={toggleFullscreen}
          />
        </div>
      </div>

      <div className="mx-auto flex w-full flex-col items-center gap-[18px]" style={{ maxWidth: MAX_W }}>
        {/* Overview: vessel graphic beside a card with recipe info + phase strip */}
        <div className="flex w-full flex-wrap items-center gap-4 md:flex-nowrap">
          <div
            className="flex h-[260px] w-full flex-none items-center justify-center md:w-[33%]"
            style={{ minWidth: '220px' }}
          >
            <BrewingAnimation phase={vesselPhase} temperature={temperature} style={{ width: '220px' }} />
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-5 rounded-2xl border border-ink-card-border bg-ink-card p-5">
            <div
              className="h-24 w-20 flex-none rounded-[10px] bg-cover bg-center"
              style={{
                backgroundImage: `url(${
                  batch.recipe?.photoUrl || srmSwatchUrl(batch.recipe?.colorSRM) || '/img/no-photo.jpg'
                })`,
              }}
            />
            <div className="min-w-[160px] flex-1">
              <p className="text-xl font-bold">{displayName}</p>
              <p className="mt-0.5 text-[13px] text-ink-text-dim">{batch.recipe?.style ?? ' '}</p>
              <div className="mt-2.5 flex items-center gap-[18px]">
                <div>
                  <p className="text-[11px] text-ink-text-faint">
                    {PHASES.indexOf(batch.phase as BatchPhase) >= 0 && batch.phase !== BatchPhase.COMPLETED
                      ? `${phaseTitle(batch.phase as BatchPhase)} progress`
                      : 'Progress'}
                  </p>
                  <p className="font-mono text-xl font-bold text-brand-500">{overallProgress}%</p>
                </div>
                {batch.recipe && (
                  <>
                    {batch.recipe.abv >= 0 && (
                      <div>
                        <p className="text-[11px] text-ink-text-faint">ABV</p>
                        <p className="font-mono text-base font-bold">{formatAbv(batch.recipe.abv, { unit: false })}</p>
                      </div>
                    )}
                    {batch.recipe.ibu >= 0 && (
                      <div>
                        <p className="text-[11px] text-ink-text-faint">IBU</p>
                        <p className="font-mono text-base font-bold">{formatIbu(batch.recipe.ibu, { unit: false })}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="flex-none rounded-[10px] border border-ink-divider bg-ink-bg px-[18px] py-3.5">
              <div className="flex flex-col gap-1.5">
                {PHASES.map((p, i) => {
                  const done = i < currentIdx || batch.phase === BatchPhase.COMPLETED;
                  const active = p === batch.phase;
                  const swatch = stepperSwatch(done, active);
                  return (
                    <div key={p} className="flex items-center gap-2">
                      <div
                        className={cn(
                          'flex size-[18px] flex-none items-center justify-center rounded-full border-[1.5px] text-[9px] font-bold',
                          swatch.bg,
                          swatch.color,
                          swatch.border,
                        )}
                      >
                        {done ? <MdCheck className="size-2.5" /> : i + 1}
                      </div>
                      <p
                        className={cn(
                          'whitespace-nowrap text-xs font-semibold',
                          active ? 'text-ink-text' : 'text-ink-text-dim',
                        )}
                      >
                        {phaseTitle(p)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col gap-[18px]">{visibleSections.map((s) => s.node)}</div>
      </div>

      <Dialog open={endModalOpen} onOpenChange={setEndModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End this session?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-ink-text-secondary">
            This marks {displayName} as canceled in RePicoBrew. This can&apos;t be undone.
          </p>
          {batch.phase === BatchPhase.BREWING && (
            <p className="rounded-lg border border-brand-500 bg-brand-100 px-3 py-2 text-sm text-ink-text">
              This does not stop your PicoBrew. If it&apos;s still brewing, stop it from the device itself.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEndModalOpen(false)}>
              Keep Brewing
            </Button>
            <Button
              variant="danger"
              disabled={endFetcher.state !== 'idle'}
              onClick={() => {
                endFetcher.submit({ intent: 'endSession' }, { method: 'post' });
                setEndModalOpen(false);
              }}
            >
              End Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={skipFermentModalOpen} onOpenChange={setSkipFermentModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skip the rest of fermentation?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-ink-text-secondary">
            There&apos;s still {fermDays}d {fermHours}h left on the estimated fermentation window. Moving to carbonation
            now skips the remaining time. This can&apos;t be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSkipFermentModalOpen(false)}>
              Keep Fermenting
            </Button>
            <Button
              variant="danger"
              disabled={fetcher.state !== 'idle'}
              onClick={() => {
                startBottling();
                setSkipFermentModalOpen(false);
              }}
            >
              Skip Fermentation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[1300] flex flex-col gap-[22px] overflow-y-auto bg-ink-bg px-4 pb-12 pt-7 md:px-8">
        {content}
      </div>
    );
  }

  return content;
};
