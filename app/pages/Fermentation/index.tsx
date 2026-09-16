import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Heading,
  HStack,
  Icon,
  Select,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Text,
  useColorModeValue,
  VStack,
} from '@chakra-ui/react';
import { useFetcher } from '@remix-run/react';
import { useEffect, useState } from 'react';
import { MdScience, MdThermostat, MdWifi, MdPlayArrow, MdStop } from 'react-icons/md';
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
  const [availableTilts, setAvailableTilts] = useState<any[]>([]);

  const fetcher = useFetcher();
  const bgCard = useColorModeValue('white', 'navy.800');
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const brandColor = useColorModeValue('brand.500', 'brand.400');

  const activeSession = sessions.find((s) => s.id === selectedSessionId);

  // Subscribe to SSE updates
  useEffect(() => {
    const eventSource = new EventSource('/api/events');

    eventSource.addEventListener('tilt-update', ((event: MessageEvent) => {
      const data: TiltUpdate = JSON.parse(event.data);
      setCurrentReading(data);

      // Update session list if needed
      setSessions((prev) => {
        const exists = prev.find((s) => s.id === data.sessionId);
        if (!exists) {
          // Refresh session list
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
      .then((data) => {
        if (data.devices) {
          setAvailableTilts(data.devices);
        }
      })
      .catch(console.error);
  }, []);

  const startSession = (deviceId: number) => {
    fetcher.submit(
      { action: 'start', deviceId: String(deviceId) },
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
    <Box pt={{ base: '130px', md: '80px', xl: '80px' }}>
      {/* Header */}
      <Flex justify="space-between" align="center" mb={6}>
        <VStack align="start" spacing={0}>
          <Heading size="lg" color={textColor}>
            Fermentation Tracking
          </Heading>
          <Text color="secondaryGray.600" fontSize="sm">
            Monitor your Tilt hydrometers in real-time
          </Text>
        </VStack>

        {sessions.length === 0 && availableTilts.length > 0 && (
          <HStack>
            <Select
              placeholder="Select a Tilt"
              size="sm"
              w="200px"
              onChange={(e) => {
                const deviceId = parseInt(e.target.value);
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
            <Button leftIcon={<Icon as={MdPlayArrow} />} colorScheme="green" size="sm">
              Start Tracking
            </Button>
          </HStack>
        )}
      </Flex>

      {sessions.length === 0 ? (
        <Card bg={bgCard} p={8}>
          <VStack spacing={4}>
            <Icon as={MdScience} w={16} h={16} color="gray.400" />
            <Heading size="md" color={textColor}>
              No Active Fermentation
            </Heading>
            <Text color="secondaryGray.600" textAlign="center">
              Start tracking a Tilt hydrometer to monitor gravity and temperature during fermentation.
            </Text>
            {availableTilts.length === 0 && (
              <Text fontSize="sm" color="orange.500">
                No Tilt devices detected. Make sure your Tilt is powered on and in range.
              </Text>
            )}
          </VStack>
        </Card>
      ) : (
        <>
          {/* Session Selector */}
          {sessions.length > 1 && (
            <Select
              value={selectedSessionId || ''}
              onChange={(e) => setSelectedSessionId(parseInt(e.target.value))}
              mb={4}
              maxW="400px"
            >
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.device.name} ({session.device.color}) - Started{' '}
                  {new Date(session.createdAt).toLocaleDateString()}
                </option>
              ))}
            </Select>
          )}

          {/* Stats Row */}
          {activeSession && (
            <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} gap={4} mb={6}>
              <Card bg={bgCard}>
                <CardBody>
                  <Stat>
                    <StatLabel>
                      <HStack>
                        <Icon as={MdScience} color={brandColor} />
                        <Text>Specific Gravity</Text>
                      </HStack>
                    </StatLabel>
                    <StatNumber fontSize="2xl">{currentReading?.gravity?.toFixed(3) || '-.---'}</StatNumber>
                    <StatHelpText>Current reading</StatHelpText>
                  </Stat>
                </CardBody>
              </Card>

              <Card bg={bgCard}>
                <CardBody>
                  <Stat>
                    <StatLabel>
                      <HStack>
                        <Icon as={MdThermostat} color="orange.500" />
                        <Text>Temperature</Text>
                      </HStack>
                    </StatLabel>
                    <StatNumber fontSize="2xl">{currentReading?.temp?.toFixed(1) || '--'}°F</StatNumber>
                    <StatHelpText>Fermentation temp</StatHelpText>
                  </Stat>
                </CardBody>
              </Card>

              <Card bg={bgCard}>
                <CardBody>
                  <Stat>
                    <StatLabel>
                      <HStack>
                        <Icon as={MdWifi} color="blue.500" />
                        <Text>Signal Strength</Text>
                      </HStack>
                    </StatLabel>
                    <StatNumber fontSize="2xl">
                      {currentReading?.rssi !== undefined ? `${currentReading.rssi} dBm` : '--'}
                    </StatNumber>
                    <StatHelpText>RSSI</StatHelpText>
                  </Stat>
                </CardBody>
              </Card>

              <Card bg={bgCard}>
                <CardBody>
                  <Stat>
                    <StatLabel>Duration</StatLabel>
                    <StatNumber fontSize="2xl">{formatDuration(activeSession.createdAt)}</StatNumber>
                    <StatHelpText>
                      <Badge colorScheme={activeSession.device.color?.toLowerCase() || 'gray'}>
                        {activeSession.device.color} Tilt
                      </Badge>
                    </StatHelpText>
                  </Stat>
                </CardBody>
              </Card>
            </SimpleGrid>
          )}

          {/* Chart */}
          {activeSession && (
            <Card bg={bgCard} mb={6}>
              <CardHeader>
                <Flex justify="space-between" align="center">
                  <Heading size="md" color={textColor}>
                    Fermentation Progress
                  </Heading>
                  <Button
                    leftIcon={<Icon as={MdStop} />}
                    colorScheme="red"
                    size="sm"
                    onClick={stopSession}
                    isLoading={fetcher.state !== 'idle'}
                  >
                    Stop Tracking
                  </Button>
                </Flex>
              </CardHeader>
              <CardBody>
                <FermentationChart sessionId={activeSession.id} />
              </CardBody>
            </Card>
          )}
        </>
      )}
    </Box>
  );
}
