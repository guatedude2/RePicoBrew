import { useEffect, useState } from 'react';
import { Box } from '@chakra-ui/react';
import { ClientOnly } from 'remix-utils';
import type { ApexOptions } from 'apexcharts';
import { Chart } from '~/components/charts/Chart.client';

interface FermentationChartProps {
  sessionId: number;
}

interface DataPoint {
  time: number;
  temp: number;
  gravity: number;
}

const TEMP_COLOR = 'oklch(0.78 0.135 65)';
const GRAVITY_COLOR = 'oklch(0.72 0.1 235)';
const TEXT_COLOR = 'oklch(0.75 0.006 260)';
const GRID_COLOR = 'oklch(0.24 0.008 260)';

export default function FermentationChart({ sessionId }: FermentationChartProps) {
  const [data, setData] = useState<DataPoint[]>([]);

  // Fetch historical data
  useEffect(() => {
    fetch(`/api/sessions/${sessionId}/logs`)
      .then((res) => res.json())
      .then((logs) => {
        const points = logs
          .filter((log: any) => log.type === 1) // Fermentation logs
          .map((log: any) => {
            const logData = JSON.parse(log.data);
            return {
              time: logData.time,
              temp: logData.temp,
              gravity: logData.gravity,
            };
          })
          .sort((a: DataPoint, b: DataPoint) => a.time - b.time);
        setData(points);
      })
      .catch(console.error);
  }, [sessionId]);

  // Subscribe to live updates
  useEffect(() => {
    const eventSource = new EventSource('/api/events');

    eventSource.addEventListener('tilt-update', ((event: MessageEvent) => {
      const update = JSON.parse(event.data);
      if (update.sessionId === sessionId) {
        setData((prev) => [
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
    },
    colors: [TEMP_COLOR, GRAVITY_COLOR],
    dataLabels: { enabled: false },
    stroke: { width: [3, 3], curve: 'smooth' },
    xaxis: {
      type: 'datetime',
      labels: {
        style: { colors: TEXT_COLOR, fontSize: '12px' },
        datetimeUTC: false,
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
      x: { format: 'MMM dd, HH:mm' },
      y: [{ formatter: (val) => `${val.toFixed(1)}°F` }, { formatter: (val) => `${val.toFixed(3)} SG` }],
    },
    legend: { labels: { colors: TEXT_COLOR } },
    grid: { borderColor: GRID_COLOR },
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
    <Box>
      {data.length === 0 ? (
        <Box textAlign="center" py={8} color="ink.textFaint">
          Waiting for first reading...
        </Box>
      ) : (
        <ClientOnly>{() => <Chart options={chartOptions} series={series} type="line" height={350} />}</ClientOnly>
      )}
    </Box>
  );
}
