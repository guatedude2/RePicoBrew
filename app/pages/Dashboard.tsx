import {
  Box,
  Flex,
  Text,
  VStack,
  HStack,
  Badge,
  Icon,
  Progress,
  SimpleGrid,
  useColorModeValue,
} from '@chakra-ui/react';
import { useLoaderData } from '@remix-run/react';
import Card from '~/components/card/Card';

import { useState, useEffect, useMemo, type FC } from 'react';
import { MdTimer, MdThermostat, MdCheckCircle } from 'react-icons/md';
import { BrewingAnimation, Phase } from '~/components/BrewingAnimation/BrewingAnimation';
import { SessionState } from '~/repositories/session.server';
import { useServerSideEvent } from '~/utils/sse';

type SessionUpdate = {
  sessionId: number;
  sessionUid: string;
  deviceId: number;
  state: SessionState;
  step: string;
  event?: string;
  wort: number;
  therm: number;
  timeLeft: number;
  isComplete: boolean;
};

// Map Pico step names to animation phases
const mapStepToPhase = (stepName: string): Phase => {
  const step = stepName.toLowerCase();
  if (step.includes('preparing')) {
    return Phase.PREPARING;
  }
  if (step.includes('heating')) {
    return Phase.HEATING;
  }
  if (step.includes('dough in') || step.includes('mash')) {
    return Phase.MASHING;
  }
  if (step.includes('boil')) {
    return Phase.BOILING;
  }
  if (step.includes('hop') || step.includes('adjunct')) {
    return Phase.BITTERING;
  }
  if (step.includes('chill')) {
    return Phase.CHILLING;
  }
  if (step.includes('ferment')) {
    return Phase.FERMENTING;
  }
  if (step.includes('carbon')) {
    return Phase.CARBONATING;
  }
  return Phase.PREPARING;
};

export const Dashboard: FC = () => {
  const { activeSessions } = useLoaderData<typeof import('~/routes/_admin.dashboard').loader>();
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const cardBg = useColorModeValue('white', 'navy.700');

  const [sessionData, setSessionData] = useState<Record<number, SessionUpdate>>({});

  // Initialize with loader data
  useEffect(() => {
    const initial: Record<number, SessionUpdate> = {};
    activeSessions.forEach((session) => {
      initial[session.id] = {
        sessionId: session.id,
        sessionUid: session.uid,
        deviceId: session.deviceId,
        state: session.state,
        step: session.statusText,
        wort: 70,
        therm: 70,
        timeLeft: session.timeRemaining || 0,
        isComplete: session.state === SessionState.COMPLETED,
      };
    });
    setSessionData(initial);
  }, [activeSessions]);

  // Listen for session updates via SSE
  useServerSideEvent<SessionUpdate>('session-update', (data) => {
    setSessionData((prev) => ({
      ...prev,
      [data.sessionId]: data,
    }));
  });

  const activeSession = activeSessions[0];
  const liveData = activeSession ? sessionData[activeSession.id] : null;

  const phase = useMemo(() => {
    if (!liveData) {
      return Phase.PREPARING;
    }
    return mapStepToPhase(liveData.step);
  }, [liveData]);

  const temperature = liveData?.wort || 70;

  if (!activeSession) {
    return (
      <Box pt={{ base: '130px', md: '80px', xl: '80px' }}>
        <Card alignItems="center" flexDirection="column" w="100%" p={8}>
          <VStack spacing={4}>
            <Icon as={MdCheckCircle} w={16} h={16} color="gray.400" />
            <Text fontSize="xl" fontWeight="700" color={textColor}>
              No Active Brew
            </Text>
            <Text color="secondaryGray.600" textAlign="center">
              Start a brew on your Pico device to see live tracking here
            </Text>
          </VStack>
        </Card>
      </Box>
    );
  }

  const progressPercent = liveData?.timeLeft ? Math.max(0, Math.min(100, 100 - (liveData.timeLeft / 180) * 100)) : 0;

  return (
    <Box pt={{ base: '130px', md: '80px', xl: '80px' }}>
      <SimpleGrid columns={{ base: 1, xl: 2 }} gap="20px" mb="20px">
        <Card alignItems="center" flexDirection="column" w="100%" p={6}>
          <VStack spacing={6} w="100%">
            <Flex w="100%" justify="space-between" align="center">
              <VStack align="start" spacing={1}>
                <Text fontSize="xl" fontWeight="700" color={textColor}>
                  {activeSession.recipe?.name || 'Custom Brew'}
                </Text>
                <HStack>
                  <Badge colorScheme={liveData?.isComplete ? 'green' : 'blue'}>
                    {liveData?.isComplete ? 'Complete' : 'Brewing'}
                  </Badge>
                  <Text fontSize="sm" color="secondaryGray.600">
                    {activeSession.device?.name || 'Unknown Device'}
                  </Text>
                </HStack>
              </VStack>
            </Flex>

            <BrewingAnimation phase={phase} temperature={temperature} w="100%" maxW="300px" />

            <VStack w="100%" spacing={3} align="stretch">
              <HStack justify="space-between">
                <HStack>
                  <Icon as={MdCheckCircle} color="brand.500" />
                  <Text fontSize="md" fontWeight="600" color={textColor}>
                    Current Step
                  </Text>
                </HStack>
                <Text fontSize="md" color={textColor}>
                  {liveData?.step || activeSession.statusText}
                </Text>
              </HStack>

              <HStack justify="space-between">
                <HStack>
                  <Icon as={MdThermostat} color="red.400" />
                  <Text fontSize="md" fontWeight="600" color={textColor}>
                    Temperature
                  </Text>
                </HStack>
                <HStack spacing={4}>
                  <Text fontSize="md" color={textColor}>
                    Wort: {liveData?.wort || 0}°F
                  </Text>
                  <Text fontSize="md" color={textColor}>
                    Therm: {liveData?.therm || 0}°F
                  </Text>
                </HStack>
              </HStack>

              <HStack justify="space-between">
                <HStack>
                  <Icon as={MdTimer} color="blue.400" />
                  <Text fontSize="md" fontWeight="600" color={textColor}>
                    Time Remaining
                  </Text>
                </HStack>
                <Text fontSize="md" color={textColor}>
                  {liveData?.timeLeft ? `${Math.floor(liveData.timeLeft / 60)}m ${liveData.timeLeft % 60}s` : '-'}
                </Text>
              </HStack>

              <Progress value={progressPercent} colorScheme="brand" size="sm" borderRadius="md" />
            </VStack>
          </VStack>
        </Card>

        <Card alignItems="center" flexDirection="column" w="100%" p={6}>
          <VStack w="100%" align="start" spacing={4}>
            <Text fontSize="xl" fontWeight="700" color={textColor}>
              Brew Timeline
            </Text>

            {liveData?.event && (
              <HStack w="100%" p={3} bg="brand.50" borderRadius="md">
                <Icon as={MdCheckCircle} color="brand.500" />
                <Text fontSize="sm" fontWeight="600">
                  Event: {liveData.event}
                </Text>
              </HStack>
            )}

            <VStack w="100%" align="stretch" spacing={2}>
              {activeSession.recipe?.steps.map((step, index) => {
                const isCurrent = liveData?.step === step.name;
                return (
                  <Flex
                    key={index}
                    p={3}
                    bg={isCurrent ? 'brand.50' : cardBg}
                    borderRadius="md"
                    borderWidth={isCurrent ? 2 : 1}
                    borderColor={isCurrent ? 'brand.500' : 'gray.200'}
                    align="center"
                    justify="space-between"
                  >
                    <HStack>
                      <Box
                        w={8}
                        h={8}
                        borderRadius="full"
                        bg={isCurrent ? 'brand.500' : 'gray.300'}
                        color="white"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        fontSize="sm"
                        fontWeight="700"
                      >
                        {index + 1}
                      </Box>
                      <VStack align="start" spacing={0}>
                        <Text fontSize="sm" fontWeight={isCurrent ? '700' : '500'} color={textColor}>
                          {step.name}
                        </Text>
                        <Text fontSize="xs" color="secondaryGray.600">
                          {step.temperature}°F · {step.stepTime}min
                        </Text>
                      </VStack>
                    </HStack>
                    {isCurrent && (
                      <Badge colorScheme="brand" fontSize="xs">
                        In Progress
                      </Badge>
                    )}
                  </Flex>
                );
              })}
            </VStack>
          </VStack>
        </Card>
      </SimpleGrid>
    </Box>
  );
};
