import type { LoaderArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData, useNavigate } from '@remix-run/react';
import {
  Box,
  Badge,
  Flex,
  Icon,
  Text,
  VStack,
  HStack,
  IconButton,
  SimpleGrid,
  useColorModeValue,
} from '@chakra-ui/react';
import { MdArrowBack, MdThermostat } from 'react-icons/md';
import { useMemo } from 'react';
import Card from '~/components/card/Card';
import { SessionRepository, SessionState } from '~/repositories/session.server';
import { LineChart } from '~/components/charts/LineChart';

export const meta = () => [{ title: 'Session Detail | RePicoBrew' }];

export const loader = async ({ params }: LoaderArgs) => {
  const id = parseInt(params.id!);
  const session = await SessionRepository.getSession(
    (await SessionRepository.listSessions({ limit: 1000 })).find((s) => s.id === id)?.uid || '',
  );

  if (!session) {
    throw new Response('Session not found', { status: 404 });
  }

  const logs = await SessionRepository.listSessionLogs(id);

  return json({ session, logs });
};

const getStateColor = (state: SessionState): string => {
  switch (state) {
    case SessionState.COMPLETED:
      return 'green';
    case SessionState.IN_PROGRESS:
      return 'blue';
    case SessionState.CANCELED:
      return 'red';
    default:
      return 'gray';
  }
};

export default function SessionDetailPage() {
  const { session, logs } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const cardBg = useColorModeValue('white', 'navy.700');
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.100');

  // Parse log data and prepare chart data
  const chartData = useMemo(() => {
    const timestamps: string[] = [];
    const wortData: number[] = [];
    const thermData: number[] = [];
    const gravityData: number[] = [];
    const tempData: number[] = [];

    const isFermentation = session.type === 3; // SessionType.FERMENTATION

    logs.forEach((log) => {
      try {
        const data = JSON.parse(log.data);
        timestamps.push(new Date(log.time).toLocaleString());

        if (isFermentation) {
          // Fermentation logs: gravity and temp
          gravityData.push(data.gravity || 0);
          tempData.push(data.temp || 0);
        } else {
          // Brew logs: wort and therm
          wortData.push(data.wort || 0);
          thermData.push(data.therm || 0);
        }
      } catch (e) {
        // Skip invalid log entries
      }
    });

    if (isFermentation) {
      return {
        labels: timestamps,
        datasets: [
          {
            label: 'Temperature (°F)',
            data: tempData,
            borderColor: '#F6AD55',
            backgroundColor: 'rgba(246, 173, 85, 0.1)',
          },
          {
            label: 'Specific Gravity',
            data: gravityData,
            borderColor: '#4299E1',
            backgroundColor: 'rgba(66, 153, 225, 0.1)',
            yAxisID: 'y1',
          },
        ],
      };
    }

    return {
      labels: timestamps,
      datasets: [
        {
          label: 'Wort Temp',
          data: wortData,
          borderColor: '#4481EB',
          backgroundColor: 'rgba(68, 129, 235, 0.1)',
        },
        {
          label: 'Therm Temp',
          data: thermData,
          borderColor: '#FF6B6B',
          backgroundColor: 'rgba(255, 107, 107, 0.1)',
        },
      ],
    };
  }, [logs, session.type]);

  // Extract events from logs
  const events = useMemo(() => {
    const eventList: Array<{ time: Date; step: string; event?: string }> = [];
    logs.forEach((log) => {
      try {
        const data = JSON.parse(log.data);
        if (data.event || data.step) {
          eventList.push({
            time: new Date(log.time),
            step: data.step,
            event: data.event,
          });
        }
      } catch (e) {
        // Skip
      }
    });
    return eventList;
  }, [logs]);

  return (
    <Box pt={{ base: '130px', md: '80px', xl: '80px' }}>
      <Card alignItems="center" flexDirection="column" w="100%" mb={4}>
        <Flex direction="column" alignItems="flex-start" w="100%" px="15px" py="10px">
          <Flex w="100%" justify="space-between" align="center" mb={4}>
            <HStack>
              <IconButton
                aria-label="Back"
                icon={<Icon as={MdArrowBack} />}
                onClick={() => navigate('/sessions')}
                variant="ghost"
              />
              <VStack align="start" spacing={1}>
                <Text fontSize="xl" fontWeight="700" color={textColor}>
                  {session.type === 3 ? `${session.device?.name} Fermentation` : session.recipe?.name || 'Custom Brew'}
                </Text>
                <HStack>
                  <Badge colorScheme={getStateColor(session.state)}>
                    {session.state === SessionState.COMPLETED
                      ? 'Completed'
                      : session.state === SessionState.IN_PROGRESS
                      ? 'In Progress'
                      : session.state === SessionState.CANCELED
                      ? 'Canceled'
                      : 'Ready'}
                  </Badge>
                  <Text fontSize="sm" color="secondaryGray.600">
                    {new Date(session.createdAt).toLocaleString()}
                  </Text>
                </HStack>
              </VStack>
            </HStack>
          </Flex>

          <SimpleGrid columns={{ base: 1, md: 3 }} gap={4} w="100%" mb={6}>
            <VStack align="start" p={4} bg={cardBg} borderRadius="md" borderWidth={1} borderColor={borderColor}>
              <Text fontSize="sm" color="secondaryGray.600">
                Device
              </Text>
              <Text fontSize="md" fontWeight="700" color={textColor}>
                {session.device?.name || 'Unknown'}
              </Text>
            </VStack>

            <VStack align="start" p={4} bg={cardBg} borderRadius="md" borderWidth={1} borderColor={borderColor}>
              <Text fontSize="sm" color="secondaryGray.600">
                Log Entries
              </Text>
              <Text fontSize="md" fontWeight="700" color={textColor}>
                {logs.length}
              </Text>
            </VStack>

            <VStack align="start" p={4} bg={cardBg} borderRadius="md" borderWidth={1} borderColor={borderColor}>
              <Text fontSize="sm" color="secondaryGray.600">
                Duration
              </Text>
              <Text fontSize="md" fontWeight="700" color={textColor}>
                {logs.length > 0
                  ? `${Math.floor(
                      (new Date(logs[logs.length - 1].time).getTime() - new Date(logs[0].time).getTime()) / 60000,
                    )}min`
                  : '-'}
              </Text>
            </VStack>
          </SimpleGrid>
        </Flex>
      </Card>

      <Card alignItems="center" flexDirection="column" w="100%" mb={4}>
        <Flex direction="column" alignItems="flex-start" w="100%" px="15px" py="10px">
          <HStack mb={4}>
            <Icon as={MdThermostat} w={6} h={6} color="brand.500" />
            <Text fontSize="xl" fontWeight="700" color={textColor}>
              {session.type === 3 ? 'Fermentation Progress' : 'Temperature Graph'}
            </Text>
          </HStack>

          <Box w="100%" h="400px">
            {chartData.labels.length > 0 ? (
              <LineChart chartData={chartData} chartOptions={{}} />
            ) : (
              <Flex w="100%" h="100%" justify="center" align="center">
                <Text color="secondaryGray.600">
                  {session.type === 3 ? 'No fermentation data available' : 'No temperature data available'}
                </Text>
              </Flex>
            )}
          </Box>
        </Flex>
      </Card>

      <Card alignItems="center" flexDirection="column" w="100%">
        <Flex direction="column" alignItems="flex-start" w="100%" px="15px" py="10px">
          <Text fontSize="xl" fontWeight="700" color={textColor} mb={4}>
            {session.type === 3 ? 'Fermentation Timeline' : 'Brew Timeline'}
          </Text>

          <VStack w="100%" align="stretch" spacing={3}>
            {events.map((event, index) => (
              <Flex
                key={index}
                p={4}
                bg={cardBg}
                borderRadius="md"
                borderWidth={1}
                borderColor={borderColor}
                align="center"
                justify="space-between"
              >
                <VStack align="start" spacing={1}>
                  <Text fontSize="sm" fontWeight="700" color={textColor}>
                    {event.step}
                  </Text>
                  {event.event && (
                    <Badge colorScheme="blue" fontSize="xs">
                      {event.event}
                    </Badge>
                  )}
                </VStack>
                <Text fontSize="sm" color="secondaryGray.600">
                  {event.time.toLocaleTimeString()}
                </Text>
              </Flex>
            ))}
          </VStack>
        </Flex>
      </Card>
    </Box>
  );
}
