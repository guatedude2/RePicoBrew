import { useRouteLoaderData } from 'react-router';

export type TimeFormat = '12h' | '24h';

export const TIME_FORMAT_CONFIG_KEY = 'TIME_FORMAT';
export const DEFAULT_TIME_FORMAT: TimeFormat = '12h';

export const parseTimeFormat = (value: unknown): TimeFormat => (value === '24h' ? '24h' : DEFAULT_TIME_FORMAT);

export const useTimeFormat = (): TimeFormat =>
  parseTimeFormat(useRouteLoaderData<typeof import('~/routes/_admin').loader>('routes/_admin')?.timeFormat);

// ApexCharts date tokens: hh = 12-hour, HH = 24-hour, TT = AM/PM.
export const chartTimeToken = (format: TimeFormat, withSeconds = false) => {
  const seconds = withSeconds ? ':ss' : '';
  return format === '24h' ? `HH:mm${seconds}` : `hh:mm${seconds} TT`;
};

export const formatClockTime = (date: Date | string, format: TimeFormat) =>
  new Date(date).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: format === '12h' });
