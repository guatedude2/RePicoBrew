import { useEffect, useState } from 'react';
import { Box, useColorModeValue } from '@chakra-ui/react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';

interface FermentationChartProps {
  sessionId: number;
}

interface DataPoint {
  time: number;
  temp: number;
  gravity: number;
}

export default function FermentationChart({ sessionId }: FermentationChartProps) {
  const [data, setData] = useState<DataPoint[]>([]);
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const bgChart = useColorModeValue('white', 'navy.900');

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
      zoom: {
        enabled: true,
      },
      background: bgChart,
      toolbar: {
        show: true,
      },
    },
    colors: ['#F6AD55', '#4299E1'], // Orange for temp, blue for gravity
    dataLabels: {
      enabled: false,
    },
    stroke: {
      width: [3, 3],
      curve: 'smooth',
    },
    xaxis: {
      type: 'datetime',
      labels: {
        style: {
          colors: textColor,
          fontSize: '12px',
        },
        datetimeUTC: false,
      },
    },
    yaxis: [
      {
        title: {
          text: 'Temperature (°F)',
          style: {
            color: '#F6AD55',
          },
        },
        labels: {
          style: {
            colors: '#F6AD55',
          },
          formatter: (val) => val.toFixed(1),
        },
      },
      {
        opposite: true,
        title: {
          text: 'Specific Gravity',
          style: {
            color: '#4299E1',
          },
        },
        labels: {
          style: {
            colors: '#4299E1',
          },
          formatter: (val) => val.toFixed(3),
        },
        min: (min) => Math.floor((min - 0.01) * 1000) / 1000,
        max: (max) => Math.ceil((max + 0.01) * 1000) / 1000,
      },
    ],
    tooltip: {
      theme: useColorModeValue('light', 'dark'),
      x: {
        format: 'MMM dd, HH:mm',
      },
      y: [
        {
          formatter: (val) => `${val.toFixed(1)}°F`,
        },
        {
          formatter: (val) => `${val.toFixed(3)} SG`,
        },
      ],
    },
    legend: {
      labels: {
        colors: textColor,
      },
    },
    grid: {
      borderColor: useColorModeValue('#E2E8F0', '#2D3748'),
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
    <Box>
      {data.length === 0 ? (
        <Box textAlign="center" py={8} color="secondaryGray.600">
          Waiting for first reading...
        </Box>
      ) : (
        <Chart options={chartOptions} series={series} type="line" height={350} />
      )}
    </Box>
  );
}
