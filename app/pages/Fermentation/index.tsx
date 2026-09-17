import { useFetcher } from 'react-router';
import { useEffect, useState } from 'react';
import { MdScience, MdStop, MdThermostat, MdTimer, MdWifi } from 'react-icons/md';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Select } from '~/components/ui/select';
import { ACCENT, StatCard } from '~/components/ui/StatCard';
import FermentationChart from './components/FermentationChart';

interface Session {
  id: number;
  uid: string;
  type: number;
  state: number;
  statusText: string;
  createdAt: string;
  updatedAt: string;
  device: {
    id: number;
    uid: string;
    name: string;
    deviceType: string;
    color: string | null;
  };
}

interface AwaitingBatch {
  id: number;
  name: string;
}

interface AvailableTilt {
  id: number;
  name: string;
  color: string | null;
  activeSession: Session | null;
}

interface DashboardProps {
  sessions: Session[];
}

interface TiltUpdate {
  sessionId: number;
  deviceId: number;
  uid: string;
  color: string;
  temp: number;
  gravity: number;
  rssi?: number;
}

export default function Fermentation({ sessions: initialSessions }: DashboardProps) {
  const [sessions, setSessions] = useState(initialSessions);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(initialSessions[0]?.id || null);
  const [currentReading, setCurrentReading] = useState<TiltUpdate | null>(null);
  const [availableTilts, setAvailableTilts] = useState<AvailableTilt[]>([]);
  const [awaitingBatches, setAwaitingBatches] = useState<AwaitingBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);

  const fetcher = useFetcher();
  const activeSession = sessions.find((s) => s.id === selectedSessionId);

  // Subscribe to SSE updates
  useEffect(() => {
    const eventSource = new EventSource('/api/events');

    eventSource.addEventListener('tilt-update', ((event: MessageEvent) => {
      const data: TiltUpdate = JSON.parse(event.data);
      setCurrentReading(data);

      setSessions((prev) => {
        const exists = prev.find((s) => s.id === data.sessionId);
        if (!exists) {
          window.location.reload();
        }
        return prev;
      });
    }) as EventListener);

    eventSource.addEventListener('tilt-seen', ((event: MessageEvent) => {
      const data = JSON.parse(event.data);
      console.log('[Tilt Seen]', data);
    }) as EventListener);

    return () => {
      eventSource.close();
    };
  }, []);

  // Fetch available Tilt devices
  useEffect(() => {
    fetch('/api/fermentation/session')
      .then((res) => res.json())
      .then((data: unknown) => {
        if (typeof data !== 'object' || data === null) {
          return;
        }
        const payload = data as { devices?: AvailableTilt[]; awaitingBatches?: AwaitingBatch[] };
        if (payload.devices) {
          setAvailableTilts(payload.devices);
        }
        if (payload.awaitingBatches) {
          setAwaitingBatches(payload.awaitingBatches);
        }
      })
      .catch(console.error);
  }, []);

  const startSession = (deviceId: number) => {
    fetcher.submit(
      { action: 'start', deviceId: String(deviceId), batchId: selectedBatchId ? String(selectedBatchId) : '' },
      { method: 'post', action: '/api/fermentation/session', encType: 'application/json' },
    );
  };

  const stopSession = () => {
    if (!activeSession) {
      return;
    }
    fetcher.submit(
      { action: 'stop', deviceId: String(activeSession.device.id) },
      { method: 'post', action: '/api/fermentation/session', encType: 'application/json' },
    );
  };

  const formatDuration = (startTime: string): string => {
    const start = new Date(startTime).getTime();
    const now = Date.now();
    const diff = now - start;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))}m`;
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[26px] font-bold tracking-[-0.3px]">Fermentation Tracking</p>
          <p className="mt-1 text-sm text-ink-text-dim">Monitor your Tilt hydrometers in real-time</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {sessions.length > 1 && (
            <Select
              value={selectedSessionId ?? ''}
              onChange={(e) => setSelectedSessionId(parseInt(e.target.value, 10))}
              className="w-auto min-w-[220px]"
            >
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.device.color} Tilt · Started {new Date(session.createdAt).toLocaleDateString()}
                </option>
              ))}
            </Select>
          )}
          {sessions.length === 1 && activeSession && (
            <div className="rounded-lg border border-ink-card-border bg-ink-card px-3.5 py-2.5 text-[13px] text-ink-text-secondary">
              {activeSession.device.color} Tilt · Started {new Date(activeSession.createdAt).toLocaleDateString()}
            </div>
          )}
          {sessions.length === 0 && availableTilts.filter((t) => !t.activeSession).length > 0 && (
            <>
              {awaitingBatches.length > 0 && (
                <Select
                  placeholder="Link to a brewing batch (optional)"
                  className="w-auto min-w-[220px]"
                  value={selectedBatchId ?? ''}
                  onChange={(e) => setSelectedBatchId(e.target.value ? parseInt(e.target.value, 10) : null)}
                >
                  {awaitingBatches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.name}
                    </option>
                  ))}
                </Select>
              )}
              <Select
                placeholder="Select a Tilt to track"
                className="w-auto min-w-[220px]"
                onChange={(e) => {
                  const deviceId = parseInt(e.target.value, 10);
                  if (deviceId) {
                    startSession(deviceId);
                  }
                }}
              >
                {availableTilts
                  .filter((t) => !t.activeSession)
                  .map((tilt) => (
                    <option key={tilt.id} value={tilt.id}>
                      {tilt.name} ({tilt.color})
                    </option>
                  ))}
              </Select>
            </>
          )}
          {activeSession && (
            <Button variant="danger" onClick={stopSession} disabled={fetcher.state !== 'idle'}>
              <MdStop />
              {fetcher.state !== 'idle' ? 'Stopping…' : 'Stop Tracking'}
            </Button>
          )}
        </div>
      </div>

      {sessions.length === 0 ? (
        <Card className="items-center gap-3.5 p-8 text-center md:p-12">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-brand-100">
            <MdScience className="size-[30px] text-brand-500" />
          </div>
          <p className="text-lg font-bold">No Active Fermentation</p>
          <p className="mx-auto max-w-[440px] text-sm text-ink-text-faint">
            Start tracking a Tilt hydrometer to monitor specific gravity and temperature during fermentation in
            real-time.
          </p>
          {availableTilts.length === 0 && (
            <div className="rounded-lg border-l-[3px] border-danger-500 bg-danger-100 px-4 py-3 text-left">
              <p className="text-[13px] font-semibold text-ink-text">
                No Tilt devices detected. Make sure your Tilt is powered on and in range.
              </p>
            </div>
          )}
        </Card>
      ) : (
        activeSession && (
          <>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 min-[1200px]:grid-cols-4">
              <StatCard
                label="Specific Gravity"
                value={currentReading?.gravity?.toFixed(3) || '-.---'}
                sub="Current reading"
                icon={MdScience}
                accent={ACCENT.purple}
              />
              <StatCard
                label="Temperature"
                value={currentReading?.temp?.toFixed(1) || '--'}
                unit="°F"
                sub="Fermentation temp"
                icon={MdThermostat}
                accent={ACCENT.danger}
              />
              <StatCard
                label="Signal Strength"
                value={currentReading?.rssi !== undefined ? String(currentReading.rssi) : '--'}
                unit=" dBm"
                sub="RSSI"
                icon={MdWifi}
                accent={ACCENT.info}
              />
              <StatCard
                label="Duration"
                value={formatDuration(activeSession.createdAt)}
                sub={`${activeSession.device.color} Tilt`}
                icon={MdTimer}
                accent={ACCENT.brand}
              />
            </div>

            <Card className="p-6">
              <div className="mb-[18px] flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-col items-start gap-0.5">
                  <p className="text-base font-bold">Fermentation Progress</p>
                  <p className="text-[13px] text-ink-text-faint">Real-time gravity and temperature tracking</p>
                </div>
                <div className="flex items-center gap-3.5 text-xs text-ink-text-secondary">
                  <div className="flex items-center gap-1.5">
                    <span className="h-0.5 w-2.5 bg-info-500" />
                    <span>Gravity</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-0.5 w-2.5 bg-brand-500" />
                    <span>Temp</span>
                  </div>
                </div>
              </div>
              <FermentationChart sessionId={activeSession.id} />
            </Card>
          </>
        )
      )}
    </>
  );
}
