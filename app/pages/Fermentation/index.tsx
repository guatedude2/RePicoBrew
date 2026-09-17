import { Box, Button, Flex, HStack, Icon, Select, SimpleGrid, Text, VStack } from '@chakra-ui/react';
import { useFetcher } from 'react-router';
import { useEffect, useState } from 'react';
import { MdScience, MdStop, MdThermostat, MdTimer, MdWifi } from 'react-icons/md';
import Card from '~/components/card/Card';
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
      <Flex align="flex-end" justify="space-between" gap="16px" wrap="wrap">
        <Box>
          <Text fontSize="26px" fontWeight="700" letterSpacing="-0.3px">
            Fermentation Tracking
          </Text>
          <Text fontSize="14px" color="ink.textDim" mt="4px">
            Monitor your Tilt hydrometers in real-time
          </Text>
        </Box>
        <HStack spacing="10px" wrap="wrap">
          {sessions.length > 1 && (
            <Select
              value={selectedSessionId ?? ''}
              onChange={(e) => setSelectedSessionId(parseInt(e.target.value, 10))}
              w="auto"
              minW="220px"
            >
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.device.color} Tilt · Started {new Date(session.createdAt).toLocaleDateString()}
                </option>
              ))}
            </Select>
          )}
          {sessions.length === 1 && activeSession && (
            <Box
              bg="ink.card"
              border="1px solid"
              borderColor="ink.cardBorder"
              borderRadius="8px"
              px="14px"
              py="10px"
              fontSize="13px"
              color="ink.textSecondary"
            >
              {activeSession.device.color} Tilt · Started {new Date(activeSession.createdAt).toLocaleDateString()}
            </Box>
          )}
          {sessions.length === 0 && availableTilts.filter((t) => !t.activeSession).length > 0 && (
            <>
              {awaitingBatches.length > 0 && (
                <Select
                  placeholder="Link to a brewing batch (optional)"
                  w="auto"
                  minW="220px"
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
                w="auto"
                minW="220px"
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
            <Button
              variant="danger"
              leftIcon={<Icon as={MdStop} />}
              onClick={stopSession}
              isLoading={fetcher.state !== 'idle'}
            >
              Stop Tracking
            </Button>
          )}
        </HStack>
      </Flex>

      {sessions.length === 0 ? (
        <Card p={{ base: '32px', md: '48px' }} alignItems="center" textAlign="center" gap="14px">
          <Flex w="64px" h="64px" borderRadius="full" bg="brand.100" align="center" justify="center" mx="auto">
            <Icon as={MdScience} boxSize="30px" color="brand.500" />
          </Flex>
          <Text fontSize="19px" fontWeight="700">
            No Active Fermentation
          </Text>
          <Text fontSize="14px" color="ink.textFaint" maxW="440px" mx="auto">
            Start tracking a Tilt hydrometer to monitor specific gravity and temperature during fermentation in
            real-time.
          </Text>
          {availableTilts.length === 0 && (
            <Box
              p="12px 16px"
              borderRadius="8px"
              bg="danger.100"
              borderLeft="3px solid"
              borderColor="danger.500"
              textAlign="left"
            >
              <Text fontSize="13px" color="ink.text" fontWeight="600">
                No Tilt devices detected. Make sure your Tilt is powered on and in range.
              </Text>
            </Box>
          )}
        </Card>
      ) : (
        activeSession && (
          <>
            <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} gap="14px">
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
            </SimpleGrid>

            <Card p="24px">
              <Flex justify="space-between" align="center" mb="18px" wrap="wrap" gap="8px">
                <VStack align="start" spacing="2px">
                  <Text fontSize="16px" fontWeight="700">
                    Fermentation Progress
                  </Text>
                  <Text fontSize="13px" color="ink.textFaint">
                    Real-time gravity and temperature tracking
                  </Text>
                </VStack>
                <HStack spacing="14px" fontSize="12px" color="ink.textSecondary">
                  <HStack spacing="6px">
                    <Box w="10px" h="2px" bg="info.500" />
                    <Text>Gravity</Text>
                  </HStack>
                  <HStack spacing="6px">
                    <Box w="10px" h="2px" bg="brand.500" />
                    <Text>Temp</Text>
                  </HStack>
                </HStack>
              </Flex>
              <FermentationChart sessionId={activeSession.id} />
            </Card>
          </>
        )
      )}
    </>
  );
}
