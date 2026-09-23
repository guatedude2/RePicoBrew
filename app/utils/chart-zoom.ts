import { useState } from 'react';

type ZoomRange = { min: number; max: number };
type AxisArgs = { xaxis?: { min?: number; max?: number } };

// ApexCharts forgets the user's zoom whenever new points re-render the chart. This remembers the visible
// x-range so it can be passed back in as `xaxis.min/max`, and clears it when the reset button is used.
export function useChartZoom() {
  const [range, setRange] = useState<ZoomRange | null>(null);
  const remember = (_chart: unknown, args: AxisArgs) => {
    const { min, max } = args?.xaxis ?? {};
    setRange(typeof min === 'number' && typeof max === 'number' ? { min, max } : null);
  };
  return {
    xaxisRange: range ? { min: range.min, max: range.max } : {},
    events: {
      zoomed: remember,
      scrolled: remember,
      beforeResetZoom: () => {
        setRange(null);
        return { xaxis: { min: undefined, max: undefined } };
      },
    },
  };
}
