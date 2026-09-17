import {
  Box,
  Button,
  Flex,
  HStack,
  Icon,
  Link,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Text,
  VStack,
} from '@chakra-ui/react';
import type { SerializeFrom } from '@remix-run/node';
import { useFetcher, useNavigate } from '@remix-run/react';
import { useEffect, useMemo, useRef, useState, type FC, type ReactNode } from 'react';
import {
  MdArrowBack,
  MdCheck,
  MdExpandMore,
  MdFullscreen,
  MdFullscreenExit,
  MdScience,
  MdThermostat,
  MdWifi,
  MdTimer,
} from 'react-icons/md';
import Card from '~/components/card/Card';
import { BrewingAnimation, Phase } from '~/components/BrewingAnimation/BrewingAnimation';
import { Chart } from '~/components/charts/Chart.client';
import { ClientOnly } from 'remix-utils';
import type { loader as sessionDetailLoader } from '~/routes/_admin.sessions.$id';
import { ACCENT, StatCard } from '~/components/ui/StatCard';
import { BatchPhase } from '~/types';
import { batchOverallProgress, phaseAccent, phaseLabel } from '~/utils/batch-phase';
import { useServerSideEvent } from '~/utils/sse';
import { CarbonationSection, CarbonationSetupForm, Ring, FERM_RING_COLOR } from './CarbonationSection';
import FermentationChart from '~/pages/Fermentation/components/FermentationChart';

type SessionDetailData = SerializeFrom<typeof sessionDetailLoader>;

const THERMO_COLOR = '#EAB308';
const WORT_COLOR = '#22C55E';
const MAX_W = '820px';

const mapStepToPhase = (stepName: string): Phase => {
  const step = stepName.toLowerCase();
  if (step.includes('preparing')) {
    return Phase.PREPARING;
  }
  if (step.includes('heating')) {
    return Phase.HEATING;
  }
  if (step.includes('dough in') || step.includes('mash')) {
    return Phase.MASHING;
  }
  if (step.includes('boil')) {
    return Phase.BOILING;
  }
  if (step.includes('hop') || step.includes('adjunct')) {
    return Phase.BITTERING;
  }
  if (step.includes('chill') || step.includes('complete')) {
    return Phase.CHILLING;
  }
  return Phase.PREPARING;
};

const fermentationTypeLabel = (t: number | null | undefined) =>
  t === 0 ? 'Ale' : t === 1 ? 'Lager' : t === 2 ? 'Advanced/Custom' : 'Standard Fermentation';

const formatDuration = (startIso: string) => {
  const hours = Math.floor((Date.now() - new Date(startIso).getTime()) / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  return days > 0 ? `${days}d ${hours % 24}h` : `${hours}h`;
};

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
  <Flex align="center" justify="space-between" gap="12px" w="100%">
    <Flex as="button" type="button" onClick={onToggle} align="center" flex="1" gap="10px">
      <Text fontSize="16px" fontWeight="700">
        {title}
      </Text>
      <Box
        fontSize="10px"
        fontWeight="700"
        px="8px"
        py="2px"
        borderRadius="999px"
        bg={`oklch(${badgeAccent} / 0.18)`}
        color={`oklch(${badgeAccent})`}
      >
        {badge}
      </Box>
    </Flex>
    {right}
    <Box as="button" type="button" onClick={onToggle}>
      <Icon
        as={MdExpandMore}
        boxSize="20px"
        color="ink.textFaint"
        transform={expanded ? 'rotate(180deg)' : undefined}
        transition="transform 0.2s"
      />
    </Box>
  </Flex>
);

const ToolbarIconButton: FC<{ icon: FC; onClick?: () => void; label: string }> = ({ icon, onClick, label }) => (
  <Box
    as="button"
    type="button"
    onClick={onClick}
    aria-label={label}
    display="flex"
    alignItems="center"
    justifyContent="center"
    w="32px"
    h="28px"
    borderRadius="6px"
    border="1px solid"
    borderColor="ink.border"
    color="ink.textSecondary"
  >
    <Icon as={icon} boxSize="14px" />
  </Box>
);

export const SessionDetail: FC<SessionDetailData> = ({ batch, brewSession, fermSession, brewLogs, tiltDevices }) => {
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const endFetcher = useFetcher();
  const startTrackingFetcher = useFetcher();
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
  const [liveBrew, setLiveBrew] = useState<{ step: string; wort: number; therm: number; timeLeft: number } | null>(
    null,
  );
  // Readings that have arrived over SSE since the last loader revalidation — plotted immediately
  // so the chart grows in real time instead of waiting for a page refresh to pick them up.
  const [liveChartPoints, setLiveChartPoints] = useState<{
    wort: Array<{ x: number; y: number }>;
    therm: Array<{ x: number; y: number }>;
  }>({ wort: [], therm: [] });
  useServerSideEvent<{ sessionId: number; step: string; wort: number; therm: number; timeLeft: number }>(
    'session-update',
    (data) => {
      if (brewSession && data.sessionId === brewSession.id) {
        setLiveBrew(data);
        const t = Date.now();
        setLiveChartPoints((prev) => ({
          wort: [...prev.wort, { x: t, y: data.wort }],
          therm: [...prev.therm, { x: t, y: data.therm }],
        }));
      }
    },
  );
  // Once brewLogs is refetched, those points are already in it — drop the live-only buffer.
  useEffect(() => {
    setLiveChartPoints({ wort: [], therm: [] });
  }, [brewLogs]);

  // Live fermentation telemetry (Tilt)
  const [liveFerm, setLiveFerm] = useState<{ gravity: number; temp: number; rssi?: number } | null>(null);
  useServerSideEvent<{ sessionId: number; gravity: number; temp: number; rssi?: number }>('tilt-update', (data) => {
    if (fermSession && data.sessionId === fermSession.id) {
      setLiveFerm(data);
    }
  });

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

  const combinedWort = useMemo(
    () => [...brewChart.wort, ...liveChartPoints.wort],
    [brewChart.wort, liveChartPoints.wort],
  );
  const combinedTherm = useMemo(
    () => [...brewChart.therm, ...liveChartPoints.therm],
    [brewChart.therm, liveChartPoints.therm],
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

  const onChartScaleChange = (chartContext: any) => {
    const g = chartContext?.w?.globals;
    if (!g || !g.gridWidth || g.minX == null || g.maxX == null || g.maxX <= g.minX) {
      return;
    }
    const pxPerMs = g.gridWidth / (g.maxX - g.minX);
    const minX = g.minX;
    const rows = computeStepLabelRows(brewChart.stepMarkers, pxPerMs, minX);

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

    brewChart.stepMarkers.forEach((_, i) => {
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
  const lastLoggedStep =
    brewChart.stepMarkers.length > 0 ? brewChart.stepMarkers[brewChart.stepMarkers.length - 1].label : null;
  const lastLoggedWort = brewChart.wort.length > 0 ? brewChart.wort[brewChart.wort.length - 1].y : null;
  const fallbackStep = brewSession?.statusText ?? lastLoggedStep;

  const phase = liveBrew
    ? mapStepToPhase(liveBrew.step)
    : fallbackStep
    ? mapStepToPhase(fallbackStep)
    : Phase.PREPARING;
  const temperature = liveBrew?.wort ?? lastLoggedWort ?? 70;
  // The vessel graphic is one continuous animated illustration for the whole session — it just
  // switches scenes (kettle / chiller / fermenter / bottles) rather than swapping to a different image.
  const vesselPhase =
    batch.phase === BatchPhase.COOLING
      ? Phase.CHILLING
      : batch.phase === BatchPhase.FERMENTING
      ? Phase.FERMENTING
      : batch.phase === BatchPhase.BOTTLING ||
        batch.phase === BatchPhase.CARBONATING ||
        batch.phase === BatchPhase.COMPLETED ||
        batch.phase === BatchPhase.CANCELED
      ? Phase.CARBONATING
      : phase;

  const coolingAvailable = phaseReached(BatchPhase.COOLING);
  const fermentationAvailable = phaseReached(BatchPhase.FERMENTING);
  const bottlingAvailable = phaseReached(BatchPhase.BOTTLING);
  const carbAvailable = phaseReached(BatchPhase.CARBONATING);

  const brewBadge = sectionBadge(BatchPhase.BREWING);
  const coolBadge = sectionBadge(BatchPhase.COOLING);
  const fermBadge = sectionBadge(BatchPhase.FERMENTING);
  const bottleBadge = sectionBadge(BatchPhase.BOTTLING);
  const carbBadge =
    batch.phase === BatchPhase.CARBONATING
      ? 'IN PROGRESS'
      : batch.phase === BatchPhase.COMPLETED
      ? 'DONE'
      : 'NOT STARTED';

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
  const fermRemainingMs = Math.max(0, fermStart + fermMs - Date.now());
  const fermDays = Math.floor(fermRemainingMs / 86400000);
  const fermHours = Math.floor((fermRemainingMs % 86400000) / 3600000);

  const fermInfoRows = batch.recipe
    ? [
        { label: 'Process', value: fermentationTypeLabel(batch.recipe.fermentationType) },
        ...(batch.recipe.yeastName ? [{ label: 'Yeast', value: batch.recipe.yeastName }] : []),
        { label: 'Fermenting Since', value: new Date(fermStart).toLocaleString() },
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
    <Card key="brew" p="22px" gap="16px">
      <SectionHeader
        title="Brewing"
        badge={brewBadge}
        badgeAccent={phaseAccent(BatchPhase.BREWING)}
        expanded={brewExpanded}
        onToggle={() => setBrewExpanded((v) => !v)}
      />
      {brewExpanded && brewSession && (
        <VStack align="stretch" spacing="16px">
          {batch.phase === BatchPhase.BREWING && liveBrew?.timeLeft ? (
            <Box textAlign="right">
              <Text
                fontSize="10px"
                fontWeight="700"
                letterSpacing="0.4px"
                color="ink.textFaint"
                textTransform="uppercase"
              >
                Time Remaining
              </Text>
              <Text fontFamily="mono" fontSize="18px" fontWeight="700" color="brand.500">
                {Math.floor(liveBrew.timeLeft / 60)}m {liveBrew.timeLeft % 60}s
              </Text>
            </Box>
          ) : null}

          <HStack justify="flex-end" spacing="14px" fontSize="12px">
            <HStack spacing="6px">
              <Box w="10px" h="10px" borderRadius="full" bg={THERMO_COLOR} />
              <Text>ThermoBlock</Text>
            </HStack>
            <HStack spacing="6px">
              <Box w="10px" h="10px" borderRadius="full" bg={WORT_COLOR} />
              <Text>Wort</Text>
            </HStack>
          </HStack>

          {combinedWort.length === 0 && (
            <Flex
              h="280px"
              align="center"
              justify="center"
              border="1px dashed"
              borderColor="ink.divider"
              borderRadius="10px"
            >
              <Text fontSize="13px" color="ink.textFaint">
                Waiting for first reading...
              </Text>
            </Flex>
          )}
          {combinedWort.length > 0 && (
            <Box h={`${brewChartBoxHeight}px`}>
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
                          mounted: (chartContext: any) => onChartScaleChange(chartContext),
                          updated: (chartContext: any) => onChartScaleChange(chartContext),
                          zoomed: (chartContext: any) => onChartScaleChange(chartContext),
                          scrolled: (chartContext: any) => onChartScaleChange(chartContext),
                        },
                      },
                      colors: [THERMO_COLOR, WORT_COLOR],
                      stroke: { width: 2, curve: 'smooth' },
                      dataLabels: { enabled: false },
                      legend: { show: false },
                      xaxis: { type: 'datetime', labels: { style: { colors: 'oklch(0.6 0.008 260)' } } },
                      yaxis: {
                        min: 0,
                        title: { text: 'TEMP (°F)', style: { color: 'oklch(0.6 0.008 260)' } },
                        labels: { style: { colors: 'oklch(0.6 0.008 260)' } },
                      },
                      grid: { borderColor: 'oklch(0.24 0.008 260)', padding: { bottom: stepLabelAreaPx } },
                      tooltip: { theme: 'dark', shared: true, x: { format: 'MMM d, h:mm:ss TT' } },
                      annotations: {
                        xaxis: brewChart.stepMarkers.map((m, i) => ({
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
            </Box>
          )}

          <Flex gap="24px" fontSize="12px" color="ink.textFaint" wrap="wrap">
            <Text>
              Machine{' '}
              <Text as="span" color="ink.text" fontWeight="600">
                {brewSession.device?.name ?? 'Unknown'}
              </Text>
            </Text>
            <Text>
              Started{' '}
              <Text as="span" color="ink.text" fontWeight="600">
                {new Date(batch.createdAt).toLocaleString()}
              </Text>
            </Text>
            {batch.phase !== BatchPhase.BREWING && batch.completedAt && (
              <Text>
                Completed{' '}
                <Text as="span" color="ink.text" fontWeight="600">
                  {new Date(batch.completedAt).toLocaleString()}
                </Text>
              </Text>
            )}
          </Flex>
        </VStack>
      )}
      {brewExpanded && !brewSession && (
        <Text fontSize="13px" color="ink.textFaint">
          No brewing data for this batch.
        </Text>
      )}
    </Card>
  );

  const coolingCard = (
    <Card key="cool" p="22px" gap="16px">
      <SectionHeader
        title="Cooling"
        badge={coolBadge}
        badgeAccent={phaseAccent(BatchPhase.COOLING)}
        expanded={coolExpanded}
        onToggle={() => setCoolExpanded((v) => !v)}
      />
      {coolExpanded &&
        (!coolingAvailable ? (
          <Text fontSize="13px" color="ink.textFaint" textAlign="center" py="20px">
            Cooling starts automatically once brewing finishes.
          </Text>
        ) : batch.phase === BatchPhase.COOLING ? (
          <Box
            bg="ink.bg"
            border="1px solid"
            borderColor="brand.500"
            borderRadius="10px"
            p="16px"
            display="flex"
            flexDirection="column"
            gap="10px"
          >
            <Text fontSize="13px" fontWeight="700">
              Start Wort Cooling
            </Text>
            <Text fontSize="13px" color="ink.textSecondary">
              Let the Brew Keg cool to room temperature — this can take up to 24 hours depending on ambient temperature.
              Once it&apos;s cool to the touch, apply the Fermentation Temperature Decal to the outside of the keg and
              pitch your yeast.{' '}
              <Link
                href="https://picobrewcontent.blob.core.windows.net/content/picoc/PicoC_Manual.pdf"
                isExternal
                color="brand.500"
                fontWeight="600"
              >
                View full instructions
              </Link>
            </Text>
            <Text fontSize="12px" color="ink.textFaint">
              Once you&apos;re ready to start fermentation, confirm below to move on.
            </Text>
            <Button
              variant="brand"
              alignSelf="flex-start"
              isLoading={startFermentationFetcher.state !== 'idle'}
              onClick={startFermentation}
            >
              Start Fermentation
            </Button>
          </Box>
        ) : (
          <Text fontSize="13px" color="ink.textFaint" textAlign="center" py="20px">
            Wort cooled — fermentation started {new Date(fermStart).toLocaleString()}.
          </Text>
        ))}
    </Card>
  );

  const fermentationCard = (
    <Card key="ferm" ref={fermSectionRef} p="22px" gap="18px">
      <SectionHeader
        title="Fermentation"
        badge={fermBadge}
        badgeAccent={phaseAccent(BatchPhase.FERMENTING)}
        expanded={fermExpanded}
        onToggle={() => setFermExpanded((v) => !v)}
      />
      {fermExpanded &&
        (!fermentationAvailable ? (
          <Text fontSize="13px" color="ink.textFaint" textAlign="center" py="20px">
            Fermentation tracking starts once cooling is done and a Tilt is dropped in the fermenter.
          </Text>
        ) : fermSession ? (
          <VStack align="stretch" spacing="16px">
            {!liveFerm && (
              <Flex
                align="center"
                gap="8px"
                bg="danger.100"
                border="1px solid"
                borderColor="danger.500"
                borderRadius="8px"
                px="14px"
                py="10px"
              >
                <Icon as={MdWifi} boxSize="16px" color="danger.500" />
                <Text fontSize="13px" fontWeight="600" color="danger.500">
                  No signal from {fermSession.device?.name ?? 'Tilt'}
                </Text>
              </Flex>
            )}
            <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} gap="14px">
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
                label="Signal Strength"
                value={liveFerm?.rssi !== undefined ? String(liveFerm.rssi) : '--'}
                unit=" dBm"
                sub="RSSI"
                icon={MdWifi}
                accent={ACCENT.info}
              />
              <StatCard
                label="Duration"
                value={formatDuration(fermSession.createdAt)}
                sub={fermSession.device?.name ?? 'Tilt'}
                icon={MdTimer}
                accent={ACCENT.brand}
              />
            </SimpleGrid>
            <Box>
              <HStack justify="flex-end" spacing="14px" fontSize="12px" mb="8px">
                <HStack spacing="6px">
                  <Box w="10px" h="2px" bg="info.500" />
                  <Text>Gravity</Text>
                </HStack>
                <HStack spacing="6px">
                  <Box w="10px" h="2px" bg="brand.500" />
                  <Text>Temp</Text>
                </HStack>
              </HStack>
              <FermentationChart sessionId={fermSession.id} />
            </Box>
            {batch.phase === BatchPhase.FERMENTING && (
              <Button variant="brand" isLoading={fetcher.state !== 'idle'} onClick={handleBottleClick}>
                {fermentationTimeUp ? 'Start Bottling' : 'Skip Fermentation'}
              </Button>
            )}
          </VStack>
        ) : (
          <VStack align="stretch" spacing="16px">
            {batch.phase === BatchPhase.FERMENTING && fermPercent < 20 && tiltDevices.length > 0 && (
              <VStack align="stretch" spacing="8px">
                <HStack spacing="10px" wrap="wrap">
                  <Select
                    size="sm"
                    w="auto"
                    minW="180px"
                    placeholder="Select a Tilt"
                    value={selectedTiltId}
                    onChange={(e) => setSelectedTiltId(e.target.value)}
                  >
                    {tiltDevices.map((d) => {
                      const label = `Tilt · ${d.color || d.name}`;
                      const unavailable = d.inUse ? 'in use' : !d.online ? 'offline' : null;
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
                    isDisabled={!selectedTiltId}
                    isLoading={startTrackingFetcher.state !== 'idle'}
                    onClick={() =>
                      startTrackingFetcher.submit(
                        { action: 'start', deviceId: selectedTiltId, batchId: String(batch.id) },
                        { method: 'post', action: '/api/fermentation/session', encType: 'application/json' },
                      )
                    }
                  >
                    Start Tracking
                  </Button>
                </HStack>
                {startTrackingFetcher.data?.error && (
                  <Text fontSize="12px" color="danger.500">
                    {startTrackingFetcher.data.error}
                  </Text>
                )}
              </VStack>
            )}
            <Flex justify="space-between" align="center" wrap="wrap" gap="24px">
              <Box>
                <Text
                  fontSize="11px"
                  fontWeight="700"
                  letterSpacing="0.5px"
                  color="ink.textFaint"
                  textTransform="uppercase"
                >
                  Total Fermentation Time Left
                </Text>
                <Text fontFamily="mono" fontSize="38px" fontWeight="300" mt="4px">
                  {fermDays}d {fermHours}h
                </Text>
              </Box>
              <Ring percent={fermPercent} label="Complete" color={FERM_RING_COLOR} />
            </Flex>
            <Box
              display="flex"
              flexDirection="column"
              border="1px solid"
              borderColor="ink.divider"
              borderRadius="10px"
              overflow="hidden"
            >
              {fermInfoRows.map((row) => (
                <Flex
                  key={row.label}
                  justify="space-between"
                  px="16px"
                  py="12px"
                  bg="ink.bg"
                  borderTop="1px solid"
                  borderColor="ink.divider"
                  fontSize="13px"
                  _first={{ borderTop: 'none' }}
                >
                  <Text color="ink.textFaint">{row.label}</Text>
                  <Text color="ink.text">{row.value}</Text>
                </Flex>
              ))}
            </Box>
            {batch.phase === BatchPhase.FERMENTING && (
              <Button variant="brand" isLoading={fetcher.state !== 'idle'} onClick={handleBottleClick}>
                {fermentationTimeUp ? 'Start Bottling' : 'Skip Fermentation'}
              </Button>
            )}
          </VStack>
        ))}
    </Card>
  );

  const bottlingCard = (
    <Card key="bottle" p="22px" gap="16px">
      <SectionHeader
        title="Bottling"
        badge={bottleBadge}
        badgeAccent={phaseAccent(BatchPhase.BOTTLING)}
        expanded={bottleExpanded}
        onToggle={() => setBottleExpanded((v) => !v)}
      />
      {bottleExpanded &&
        (!bottlingAvailable ? (
          <Text fontSize="13px" color="ink.textFaint" textAlign="center" py="20px">
            Bottling starts once fermentation is done.
          </Text>
        ) : batch.phase === BatchPhase.BOTTLING ? (
          <Box display="flex" flexDirection="column" gap="14px">
            <Text fontSize="13px" color="ink.textSecondary">
              Rack the beer into bottles (or a keg), then choose how you&apos;re carbonating and start the countdown.
            </Text>
            <CarbonationSetupForm
              batchId={batch.id}
              initialMethod={batch.carbMethod}
              initialDuration={batch.carbDuration}
            />
          </Box>
        ) : (
          <Text fontSize="13px" color="ink.textFaint" textAlign="center" py="20px">
            Bottled — carbonation {batch.phase === BatchPhase.COMPLETED ? 'complete' : 'in progress'}.
          </Text>
        ))}
    </Card>
  );

  const carbonationCard = (
    <Card key="carb" p="22px" gap="16px">
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
          <Text fontSize="13px" color="ink.textFaint" textAlign="center" py="20px">
            Carbonation starts once you&apos;ve bottled and picked a method. There&apos;s no sensor tracking here — just
            a countdown.
          </Text>
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
  const activeSectionKey =
    batch.phase === BatchPhase.BREWING
      ? 'brew'
      : batch.phase === BatchPhase.COOLING
      ? 'cool'
      : batch.phase === BatchPhase.FERMENTING
      ? 'ferm'
      : batch.phase === BatchPhase.BOTTLING
      ? 'bottle'
      : batch.phase === BatchPhase.CARBONATING
      ? 'carb'
      : null;
  const visibleSections =
    fullscreen && activeSectionKey ? orderedSections.filter((s) => s.key === activeSectionKey) : orderedSections;

  const content = (
    <>
      <Flex align="center" justify="space-between" gap="16px" wrap="wrap">
        <HStack spacing="12px">
          {!fullscreen && (
            <Box
              as="button"
              type="button"
              onClick={() => navigate('/sessions')}
              display="flex"
              alignItems="center"
              justifyContent="center"
              w="32px"
              h="32px"
              borderRadius="7px"
              bg="ink.card"
              border="1px solid"
              borderColor="ink.cardBorder"
            >
              <Icon as={MdArrowBack} boxSize="15px" />
            </Box>
          )}
          <Box>
            <Text fontSize="19px" fontWeight="700">
              {batch.name}
            </Text>
            <Text fontSize="12px" color="ink.textFaint">
              {brewSession?.device?.name ?? fermSession?.device?.name ?? 'Unknown device'}
            </Text>
          </Box>
        </HStack>
        <HStack spacing="10px">
          <HStack
            spacing="6px"
            fontSize="11px"
            fontWeight="700"
            px="10px"
            py="4px"
            borderRadius="999px"
            bg={`oklch(${phaseAccent(batch.phase)} / 0.15)`}
            color={`oklch(${phaseAccent(batch.phase)})`}
          >
            {isLive && (
              <Box
                w="6px"
                h="6px"
                borderRadius="full"
                bg={`oklch(${phaseAccent(batch.phase)})`}
                sx={{ animation: 'pulse-dot 1.6s infinite' }}
              />
            )}
            <Text>{phaseLabel(batch.phase)}</Text>
          </HStack>
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
        </HStack>
      </Flex>

      <Box maxW={MAX_W} w="100%" mx="auto" display="flex" flexDirection="column" alignItems="center" gap="18px">
        {/* Overview: vessel graphic beside a card with recipe info + phase strip */}
        <Flex w="100%" gap="16px" align="center" wrap={{ base: 'wrap', md: 'nowrap' }}>
          <Flex w={{ base: '100%', md: '33%' }} minW="220px" h="260px" flex="0 0 auto" align="center" justify="center">
            <BrewingAnimation phase={vesselPhase} temperature={temperature} w="220px" />
          </Flex>
          <Flex
            flex="1"
            bg="ink.card"
            border="1px solid"
            borderColor="ink.cardBorder"
            borderRadius="14px"
            p="20px"
            gap="20px"
            wrap="wrap"
            align="center"
          >
            {batch.recipe?.photoUrl ? (
              <Box
                w="80px"
                h="96px"
                borderRadius="10px"
                bgImage={`url(${batch.recipe.photoUrl})`}
                bgSize="cover"
                bgPosition="center"
                flex="0 0 auto"
              />
            ) : (
              <Box w="80px" h="96px" borderRadius="10px" bg="ink.bg" flex="0 0 auto" />
            )}
            <Box flex="1" minW="160px">
              <Text fontSize="22px" fontWeight="700">
                {batch.name}
              </Text>
              <Text fontSize="13px" color="ink.textDim" mt="2px">
                {batch.recipe?.style ?? ' '}
              </Text>
              <HStack spacing="18px" mt="10px">
                <Box>
                  <Text fontSize="11px" color="ink.textFaint">
                    Progress
                  </Text>
                  <Text fontFamily="mono" fontSize="22px" fontWeight="700" color="brand.500">
                    {overallProgress}%
                  </Text>
                </Box>
                {batch.recipe && (
                  <>
                    <Box>
                      <Text fontSize="11px" color="ink.textFaint">
                        ABV
                      </Text>
                      <Text fontFamily="mono" fontSize="16px" fontWeight="700">
                        {batch.recipe.abv}%
                      </Text>
                    </Box>
                    <Box>
                      <Text fontSize="11px" color="ink.textFaint">
                        IBU
                      </Text>
                      <Text fontFamily="mono" fontSize="16px" fontWeight="700">
                        {batch.recipe.ibu}
                      </Text>
                    </Box>
                  </>
                )}
              </HStack>
            </Box>
            <Box
              flex="0 0 auto"
              bg="ink.bg"
              border="1px solid"
              borderColor="ink.divider"
              borderRadius="10px"
              p="14px 18px"
            >
              <VStack align="stretch" spacing="6px">
                {PHASES.map((p, i) => {
                  const done = i < currentIdx || batch.phase === BatchPhase.COMPLETED;
                  const active = p === batch.phase;
                  return (
                    <HStack key={p} spacing="8px">
                      <Flex
                        w="18px"
                        h="18px"
                        borderRadius="full"
                        align="center"
                        justify="center"
                        fontSize="9px"
                        fontWeight="700"
                        flex="0 0 auto"
                        bg={done ? 'success.100' : active ? 'brand.500' : 'ink.card'}
                        color={done ? 'success.500' : active ? 'ink.onBrand' : 'ink.textFaint'}
                        border="1.5px solid"
                        borderColor={done ? 'success.500' : active ? 'brand.500' : 'ink.borderStrong'}
                      >
                        {done ? <Icon as={MdCheck} boxSize="10px" /> : i + 1}
                      </Flex>
                      <Text
                        fontSize="12px"
                        fontWeight="600"
                        color={active ? 'ink.text' : 'ink.textDim'}
                        whiteSpace="nowrap"
                      >
                        {p === BatchPhase.CARBONATING
                          ? 'Carbonation'
                          : p === BatchPhase.FERMENTING
                          ? 'Fermentation'
                          : p}
                      </Text>
                    </HStack>
                  );
                })}
              </VStack>
            </Box>
          </Flex>
        </Flex>

        <Box w="100%" display="flex" flexDirection="column" gap="18px">
          {visibleSections.map((s) => s.node)}
        </Box>
      </Box>

      <Modal isOpen={endModalOpen} onClose={() => setEndModalOpen(false)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>End this session?</ModalHeader>
          <ModalBody>
            <Text fontSize="14px" color="ink.textSecondary">
              This stops {batch.name} now and marks the session as canceled. This can&apos;t be undone.
            </Text>
          </ModalBody>
          <ModalFooter gap="10px">
            <Button variant="outline" onClick={() => setEndModalOpen(false)}>
              Keep Brewing
            </Button>
            <Button
              variant="danger"
              isLoading={endFetcher.state !== 'idle'}
              onClick={() => {
                endFetcher.submit({ intent: 'endSession' }, { method: 'post' });
                setEndModalOpen(false);
              }}
            >
              End Session
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={skipFermentModalOpen} onClose={() => setSkipFermentModalOpen(false)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Skip the rest of fermentation?</ModalHeader>
          <ModalBody>
            <Text fontSize="14px" color="ink.textSecondary">
              There&apos;s still {fermDays}d {fermHours}h left on the estimated fermentation window. Moving to
              carbonation now skips the remaining time. This can&apos;t be undone.
            </Text>
          </ModalBody>
          <ModalFooter gap="10px">
            <Button variant="outline" onClick={() => setSkipFermentModalOpen(false)}>
              Keep Fermenting
            </Button>
            <Button
              variant="danger"
              isLoading={fetcher.state !== 'idle'}
              onClick={() => {
                startBottling();
                setSkipFermentModalOpen(false);
              }}
            >
              Skip Fermentation
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );

  if (fullscreen) {
    return (
      <Box
        position="fixed"
        inset={0}
        zIndex={1300}
        bg="ink.bg"
        overflowY="auto"
        px={{ base: '16px', md: '32px' }}
        pt="28px"
        pb="48px"
        display="flex"
        flexDirection="column"
        gap="22px"
      >
        {content}
      </Box>
    );
  }

  return content;
};

export default SessionDetail;
