import { useCallback, useEffect, useRef, useState } from 'react';

export type SessionLogRow = { id: number; type: number; time: string; data: string };
type Range = { min: number; max: number };

const t = (row: SessionLogRow) => new Date(row.time).getTime();

// Loads a session's (server-thinned) log history on the client and, while zoomed in, swaps in a denser fetch of
// just the visible window. Pass `onZoomChange` to useChartZoom; `logs` is what to plot.
export function useSessionLogs(sessionId: number | null | undefined) {
  const [overview, setOverview] = useState<SessionLogRow[]>([]);
  const [loading, setLoading] = useState(Boolean(sessionId));
  const [detail, setDetail] = useState<{ range: Range; rows: SessionLogRow[] } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const abort = useRef<AbortController>();

  useEffect(() => {
    setDetail(null);
    if (!sessionId) {
      setOverview([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/sessions/${sessionId}/logs`, { signal: controller.signal })
      .then((res) => res.json())
      .then((rows: unknown) => {
        if (Array.isArray(rows)) {
          setOverview(rows as SessionLogRow[]);
        }
        setLoading(false);
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') {
          console.error(error);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [sessionId]);

  const onZoomChange = useCallback(
    (range: Range | null) => {
      clearTimeout(timer.current);
      abort.current?.abort();
      if (!range || !sessionId) {
        setDetail(null);
        return;
      }
      timer.current = setTimeout(() => {
        const controller = new AbortController();
        abort.current = controller;
        fetch(`/api/sessions/${sessionId}/logs?from=${Math.floor(range.min)}&to=${Math.ceil(range.max)}&max=800`, {
          signal: controller.signal,
        })
          .then((res) => res.json())
          .then((rows: unknown) => {
            if (Array.isArray(rows)) {
              setDetail({ range, rows: rows as SessionLogRow[] });
            }
          })
          .catch(() => {});
      }, 250);
    },
    [sessionId],
  );

  const logs = detail
    ? [...overview.filter((r) => t(r) < detail.range.min || t(r) > detail.range.max), ...detail.rows].sort(
        (a, b) => t(a) - t(b),
      )
    : overview;

  return { logs, loading, onZoomChange };
}
