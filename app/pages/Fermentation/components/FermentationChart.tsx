import { useEffect, useMemo, useState } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import type { ApexOptions } from 'apexcharts';
import { ChartMenu } from '~/components/charts/ChartMenu';
import { Chart } from '~/components/charts/Chart.client';
import { useChartZoom } from '~/utils/chart-zoom';
import { useSessionLogs } from '~/utils/session-logs';
import { expectedGravityAt, projectGravity, resolveGravityTargets, sampleCurve } from '~/utils/gravity-projection';
import { chartTimeToken, useTimeFormat } from '~/utils/time-format';

interface FermentationChartProps {
  sessionId: number;
  // When the fermentation started and how long the recipe expects it to run: together they set the chart's default
  // date range (start to start + days, stretched to include any later readings).
  startTime?: string | number | Date | null;
  fermentDays?: number | null;
  // With the recipe's gravity targets and the fermentation length, the chart also draws a dashed EXPECTED gravity
  // curve and a dashed PROJECTED one (the current trend carried to the end of the window); see gravity-projection.ts.
  expectedGravity?: {
    days: number;
    recipeOg?: number | null;
    recipeFg?: number | null;
    recipeAbv?: number | null;
    yeastAttenuation?: number | null;
  } | null;
}

const DAY_MS = 86400000;
const MAX_DAY_LINES = 120;

// Local-time midnights after `min` up to `max`, for the day dividers.
function midnightsBetween(min: number, max: number): number[] {
  const out: number[] = [];
  const d = new Date(min);
  d.setHours(24, 0, 0, 0);
  while (d.getTime() <= max && out.length < MAX_DAY_LINES) {
    out.push(d.getTime());
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
  }
  return out;
}

interface DataPoint {
  time: number;
  temp: number;
  gravity: number;
}

type FermLogPayload = {
  time?: number;
  temp?: number;
  gravity?: number;
};

const TEMP_COLOR = 'oklch(0.78 0.135 65)';
const GRAVITY_COLOR = 'oklch(0.72 0.1 235)';
const TEXT_COLOR = 'oklch(0.75 0.006 260)';
const GRID_COLOR = 'oklch(0.24 0.008 260)';
const DAY_LINE_COLOR = 'oklch(0.42 0.01 260)';
const PROJECTED_COLOR = 'oklch(0.85 0.09 235)';
const EXPECTED_COLOR = 'oklch(0.75 0.14 150)';

export default function FermentationChart({
  sessionId,
  startTime,
  fermentDays,
  expectedGravity,
}: FermentationChartProps) {
  const timeFormat = useTimeFormat();

  const { logs, onZoomChange } = useSessionLogs(sessionId);
  const history = useMemo(
    () =>
      logs
        .filter((log) => log.type === 1)
        .map((log) => {
          const logData = JSON.parse(log.data) as FermLogPayload;
          return { time: logData.time ?? 0, temp: logData.temp ?? 0, gravity: logData.gravity ?? 0 };
        })
        .sort((a, b) => a.time - b.time),
    [logs],
  );
  const [live, setLive] = useState<DataPoint[]>([]);
  // Live points only count once they're newer than the fetched history (which may already include them).
  const lastHistoryTime = history.length > 0 ? history[history.length - 1].time : -Infinity;
  const data = useMemo(
    () => [...history, ...live.filter((p) => p.time > lastHistoryTime)],
    [history, live, lastHistoryTime],
  );
  const startMs = startTime ? new Date(startTime).getTime() : null;
  const lastDataMs = data.length > 0 ? data[data.length - 1].time : null;
  const defaultRange =
    fermentDays && startMs !== null && Number.isFinite(startMs)
      ? { min: startMs, max: Math.max(startMs + fermentDays * DAY_MS, lastDataMs ?? 0) }
      : null;
  const zoom = useChartZoom(
    data.length > 0 ? [data[0].time, data[data.length - 1].time] : null,
    onZoomChange,
    defaultRange,
  );
  // Day dividers across everything the chart can show (the default range and all the data); lines outside the
  // visible range simply aren't drawn.
  const dayLines =
    data.length > 0
      ? midnightsBetween(
          Math.min(data[0].time, defaultRange?.min ?? Infinity),
          Math.max(data[data.length - 1].time, defaultRange?.max ?? -Infinity),
        )
      : [];

  // Subscribe to live updates
  useEffect(() => {
    const eventSource = new EventSource('/api/events');

    eventSource.addEventListener('tilt-update', ((event: MessageEvent) => {
      const update = JSON.parse(event.data);
      if (update.sessionId === sessionId) {
        setLive((prev) => [
          ...prev,
          {
            time: Date.now(),
            temp: update.temp,
            gravity: update.gravity,
          },
        ]);
      }
    }) as EventListener);

    return () => {
      eventSource.close();
    };
  }, [sessionId]);

  // Expected and projected gravity, both dashed on the gravity axis. Only with the recipe targets, a known start and
  // a live gravity trend; otherwise the chart is just temperature and gravity as before.
  const gravityLines = (() => {
    if (!expectedGravity || startMs === null || !Number.isFinite(startMs) || data.length === 0) {
      return null;
    }
    const endMs = startMs + expectedGravity.days * DAY_MS;
    const gravityReadings = data.filter((d) => d.gravity > 0).map((d) => ({ time: d.time, gravity: d.gravity }));
    const targets = resolveGravityTargets({ ...expectedGravity, firstReading: gravityReadings[0]?.gravity ?? null });
    if (!targets) {
      return null;
    }
    const expected = sampleCurve((t) => expectedGravityAt(t, startMs, endMs, targets), startMs, endMs);
    const projection = projectGravity(gravityReadings, targets.fg);
    const last = gravityReadings[gravityReadings.length - 1];
    const projected =
      projection && last && last.time < endMs
        ? [{ x: last.time, y: last.gravity }, ...sampleCurve(projection.at, last.time, endMs, 30).slice(1)]
        : [];
    return { expected, projected };
  })();

  // One explicit scale for every gravity line (the actual, expected and projected ones each get their own axis object
  // in ApexCharts, which would otherwise each auto-scale to just their own values).
  const gravityScale = (() => {
    if (!gravityLines) {
      return null;
    }
    const values = [
      ...data.map((d) => d.gravity).filter((g) => g > 0),
      ...gravityLines.expected.map((p) => p.y),
      ...gravityLines.projected.map((p) => p.y),
    ];
    return {
      min: Math.floor((Math.min(...values) - 0.005) * 1000) / 1000,
      max: Math.ceil((Math.max(...values) + 0.005) * 1000) / 1000,
    };
  })();

  const chartOptions: ApexOptions = {
    chart: {
      type: 'line',
      height: 350,
      zoom: { enabled: true },
      background: 'transparent',
      toolbar: { show: true },
      events: zoom.events,
    },
    colors: gravityLines ? [TEMP_COLOR, GRAVITY_COLOR, PROJECTED_COLOR, EXPECTED_COLOR] : [TEMP_COLOR, GRAVITY_COLOR],
    dataLabels: { enabled: false },
    stroke: gravityLines
      ? { width: [3, 3, 2, 2], curve: 'smooth', dashArray: [0, 0, 6, 6] }
      : { width: [3, 3], curve: 'smooth' },
    xaxis: {
      type: 'datetime',
      ...zoom.xaxisRange,
      labels: {
        style: { colors: TEXT_COLOR, fontSize: '12px' },
        datetimeUTC: false,
        datetimeFormatter: {
          hour: chartTimeToken(timeFormat),
          minute: chartTimeToken(timeFormat),
          second: chartTimeToken(timeFormat, true),
        },
      },
      axisBorder: { color: GRID_COLOR },
      axisTicks: { color: GRID_COLOR },
    },
    yaxis: [
      {
        title: { text: 'Temperature (°F)', style: { color: TEMP_COLOR } },
        labels: { style: { colors: TEMP_COLOR }, formatter: (val) => val.toFixed(1) },
      },
      {
        opposite: true,
        title: { text: 'Specific Gravity', style: { color: GRAVITY_COLOR } },
        labels: { style: { colors: GRAVITY_COLOR }, formatter: (val) => val.toFixed(3) },
        min: gravityScale ? gravityScale.min : (min) => Math.floor((min - 0.01) * 1000) / 1000,
        max: gravityScale ? gravityScale.max : (max) => Math.ceil((max + 0.01) * 1000) / 1000,
      },
      // The dashed expected/projected lines share the gravity axis (same seriesName, axis hidden).
      ...(gravityLines
        ? [
            { seriesName: 'Specific Gravity', show: false, opposite: true, ...gravityScale },
            { seriesName: 'Specific Gravity', show: false, opposite: true, ...gravityScale },
          ]
        : []),
    ],
    tooltip: {
      theme: 'dark',
      x: { format: `MMM dd, ${chartTimeToken(timeFormat)}` },
      y: [
        { formatter: (val) => `${val.toFixed(1)}°F` },
        ...Array.from({ length: gravityLines ? 3 : 1 }, () => ({ formatter: (val: number) => `${val.toFixed(3)} SG` })),
      ],
    },
    legend: { labels: { colors: TEXT_COLOR } },
    grid: { borderColor: GRID_COLOR },
    annotations: {
      xaxis: dayLines.map((x) => ({ x, borderColor: DAY_LINE_COLOR, strokeDashArray: 4 })),
    },
  };

  const series = [
    {
      name: 'Temperature',
      type: 'line',
      data: data.map((d) => ({ x: d.time, y: d.temp })),
    },
    {
      name: 'Specific Gravity',
      type: 'line',
      data: data.map((d) => ({ x: d.time, y: d.gravity })),
    },
    ...(gravityLines
      ? [
          { name: 'Projected gravity', type: 'line', data: gravityLines.projected },
          { name: 'Expected gravity', type: 'line', data: gravityLines.expected },
        ]
      : []),
  ];

  return (
    <div>
      {data.length === 0 ? (
        <div className="py-8 text-center text-ink-text-faint">Waiting for first reading...</div>
      ) : (
        <ChartMenu>
          <ClientOnly>{() => <Chart options={chartOptions} series={series} type="line" height={350} />}</ClientOnly>
        </ChartMenu>
      )}
    </div>
  );
}
