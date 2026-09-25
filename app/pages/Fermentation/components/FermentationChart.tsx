import { useEffect, useMemo, useState } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import type { ApexOptions } from 'apexcharts';
import { ChartMenu } from '~/components/charts/ChartMenu';
import { Chart } from '~/components/charts/Chart.client';
import { useChartZoom } from '~/utils/chart-zoom';
import { useSessionLogs } from '~/utils/session-logs';
import { chartTimeToken, useTimeFormat } from '~/utils/time-format';

interface FermentationChartProps {
  sessionId: number;
  // When the fermentation started and how long the recipe expects it to run: together they set the chart's default
  // date range (start to start + days, stretched to include any later readings).
  startTime?: string | number | Date | null;
  fermentDays?: number | null;
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

export default function FermentationChart({ sessionId, startTime, fermentDays }: FermentationChartProps) {
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

  const chartOptions: ApexOptions = {
    chart: {
      type: 'line',
      height: 350,
      zoom: { enabled: true },
      background: 'transparent',
      toolbar: { show: true },
      events: zoom.events,
    },
    colors: [TEMP_COLOR, GRAVITY_COLOR],
    dataLabels: { enabled: false },
    stroke: { width: [3, 3], curve: 'smooth' },
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
        min: (min) => Math.floor((min - 0.01) * 1000) / 1000,
        max: (max) => Math.ceil((max + 0.01) * 1000) / 1000,
      },
    ],
    tooltip: {
      theme: 'dark',
      x: { format: `MMM dd, ${chartTimeToken(timeFormat)}` },
      y: [{ formatter: (val) => `${val.toFixed(1)}°F` }, { formatter: (val) => `${val.toFixed(3)} SG` }],
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
