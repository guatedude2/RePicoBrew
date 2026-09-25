import { useRef } from 'react';

type ZoomRange = { min: number; max: number };
type AxisArgs = { xaxis?: { min?: number; max?: number } };

// ApexCharts forgets the user's zoom whenever new points re-render the chart. This remembers the visible
// x-range so it can be passed back in as `xaxis.min/max`, and clears it when the reset button is used.
// Apex also fires `zoomed` when it merely re-fits the axis to the data, so a range is only kept when it is
// genuinely narrower than the data (`extent` = [first, last] x value) — otherwise history would get hidden.
export function useChartZoom(
  extent: readonly [number, number] | null,
  onZoomChange?: (range: ZoomRange | null) => void,
  // The range shown when the user hasn't zoomed (and what "Reset zoom" returns to); the chart's own auto range if null.
  defaultRange?: ZoomRange | null,
) {
  // A ref, not state: re-rendering in the middle of a zoom gesture interrupts it. The range is only needed
  // the next time new data re-renders the chart anyway.
  const rangeRef = useRef<ZoomRange | null>(null);
  const extentRef = useRef(extent);
  extentRef.current = extent;
  const defaultRef = useRef(defaultRange ?? null);
  defaultRef.current = defaultRange ?? null;

  const remember = (_chart: unknown, args: AxisArgs) => {
    const { min, max } = args?.xaxis ?? {};
    const current = extentRef.current;
    const isZoomed =
      typeof min === 'number' &&
      typeof max === 'number' &&
      min < max &&
      current !== null &&
      (min > current[0] || max < current[1]) &&
      // Apex reports the default range back as a "zoom" when it re-fits the axis; that isn't the user zooming.
      !(
        defaultRef.current &&
        Math.abs(min - defaultRef.current.min) < 1000 &&
        Math.abs(max - defaultRef.current.max) < 1000
      );
    rangeRef.current = isZoomed ? { min, max } : null;
    onZoomChange?.(rangeRef.current);
  };
  return {
    xaxisRange: rangeRef.current ?? defaultRange ?? {},
    events: {
      zoomed: remember,
      scrolled: remember,
      beforeResetZoom: () => {
        rangeRef.current = null;
        onZoomChange?.(null);
        return { xaxis: { min: defaultRef.current?.min, max: defaultRef.current?.max } };
      },
    },
  };
}
