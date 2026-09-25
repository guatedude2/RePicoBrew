import { useRef, useState, type FC } from 'react';
import type { Props } from 'react-apexcharts';
import ReactApexChart from 'react-apexcharts';

// react-apexcharts redraws the whole chart (destroying an open tooltip) whenever its deep comparison of `options`
// finds a difference — and functions compare by identity, so every inline formatter/event handler made a fresh
// "change" on every parent render (the session page re-renders every second). Two fixes, applied to every chart:
//
//  1. Function-valued options are swapped for stable proxies that call the latest function, so an unchanged chart
//     is not redrawn just because its parent re-rendered.
//  2. While the pointer is over the chart, `options`/`series` are held at what was on screen when it arrived (live
//     readings keep flowing in underneath); the latest data is applied as soon as the pointer leaves. Otherwise a new
//     reading every few seconds would still close the tooltip.

type AnyFn = (...args: unknown[]) => unknown;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && Object.getPrototypeOf(v) === Object.prototype;

export const Chart: FC<Props> = ({ options, series, ...rest }) => {
  const hovering = useRef(false);
  const [, rerender] = useState(0);
  const latestFns = useRef(new Map<string, AnyFn>());
  const proxies = useRef(new Map<string, AnyFn>());
  const rendered = useRef<{ options: Props['options']; series: Props['series'] } | null>(null);
  const frozen = useRef<{ options: Props['options']; series: Props['series'] } | null>(null);

  const stabilize = (value: unknown, path: string): unknown => {
    if (typeof value === 'function') {
      if (!hovering.current || !latestFns.current.has(path)) {
        latestFns.current.set(path, value as AnyFn);
      }
      let proxy = proxies.current.get(path);
      if (!proxy) {
        proxy = (...args: unknown[]) => latestFns.current.get(path)?.(...args);
        proxies.current.set(path, proxy);
      }
      return proxy;
    }
    if (Array.isArray(value)) {
      return value.map((item, i) => stabilize(item, `${path}.${i}`));
    }
    if (isPlainObject(value)) {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stabilize(v, `${path}.${k}`)]));
    }
    return value;
  };

  let shown: { options: Props['options']; series: Props['series'] };
  if (hovering.current && frozen.current) {
    shown = frozen.current;
  } else {
    shown = { options: stabilize(options, '') as Props['options'], series };
    rendered.current = shown;
  }

  return (
    // `display: contents`: this wrapper only listens for the pointer and adds no box of its own to the layout.
    <div
      style={{ display: 'contents' }}
      onMouseEnter={() => {
        frozen.current = rendered.current;
        hovering.current = true;
      }}
      onMouseLeave={() => {
        hovering.current = false;
        frozen.current = null;
        rerender((n) => n + 1);
      }}
    >
      <ReactApexChart {...rest} options={shown.options} series={shown.series} />
    </div>
  );
};
