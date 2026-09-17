import { Box, Button, Flex, Grid, GridItem, HStack, Icon, Text, Tooltip } from '@chakra-ui/react';
import { Link, useLoaderData, useRouteLoaderData } from '@remix-run/react';
import { useEffect, useState, type FC } from 'react';
import { GiHops } from 'react-icons/gi';
import { IoIosBeer } from 'react-icons/io';
import { MdAdd, MdChevronRight, MdDevicesOther, MdScience, MdWarning } from 'react-icons/md';
import Card from '~/components/card/Card';
import { ACCENT, StatCard } from '~/components/ui/StatCard';
import { BatchPhase } from '~/types';
import { phaseAccent, phaseLabel } from '~/utils/batch-phase';
import { useServerSideEvent } from '~/utils/sse';

type SessionUpdate = {
  sessionId: number;
  step: string;
  wort: number;
  therm: number;
  timeLeft: number;
};

const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export const Dashboard: FC = () => {
  const { ongoingBrews, fermentingCount, recentBatches } =
    useLoaderData<typeof import('~/routes/_admin.dashboard').loader>();
  const adminData = useRouteLoaderData<typeof import('~/routes/_admin').loader>('routes/_admin');
  const userName = adminData?.session?.name;
  const deviceStatus = adminData?.deviceStatus ?? { online: 0, total: 0 };

  const [greeting, setGreeting] = useState('Welcome back');
  const [today, setToday] = useState('');
  useEffect(() => {
    const now = new Date();
    const hour = now.getHours();
    setGreeting(hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');
    setToday(now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }));
  }, []);

  const [liveBySession, setLiveBySession] = useState<Record<number, SessionUpdate>>({});
  useServerSideEvent<SessionUpdate>('session-update', (data) => {
    setLiveBySession((prev) => ({ ...prev, [data.sessionId]: data }));
  });

  return (
    <>
      <Flex align="flex-end" justify="space-between" gap="16px" wrap="wrap">
        <Box>
          <Text fontSize="26px" fontWeight="700" letterSpacing="-0.3px">
            {greeting}
            {userName ? `, ${userName}` : ''}
          </Text>
          <Text fontSize="14px" color="ink.textDim" mt="4px">
            {today}
          </Text>
        </Box>
        <HStack spacing="10px">
          <Link to="/recipes">
            <Button variant="outline" size="sm" leftIcon={<Icon as={IoIosBeer} />}>
              View Recipes
            </Button>
          </Link>
          <Link to="/sessions/new">
            <Button variant="brand" size="sm" leftIcon={<Icon as={MdAdd} />}>
              Start a Brew
            </Button>
          </Link>
        </HStack>
      </Flex>

      <Grid templateColumns={{ base: '1fr', '2sm': '1fr 1fr', xl: 'repeat(3, 1fr)' }} gap="14px">
        <StatCard
          label="Active Sessions"
          value={String(ongoingBrews.length)}
          sub={
            ongoingBrews[0]
              ? `${ongoingBrews[0].name} ${phaseLabel(ongoingBrews[0].phase).toLowerCase()}`
              : 'No brews running'
          }
          icon={GiHops}
          accent={ACCENT.brand}
        />
        <StatCard
          label="Devices Online"
          value={`${deviceStatus.online}/${deviceStatus.total}`}
          sub={`${deviceStatus.total} device${deviceStatus.total === 1 ? '' : 's'} registered`}
          icon={MdDevicesOther}
          accent={ACCENT.success}
        />
        <StatCard
          label="Fermentation"
          value={String(fermentingCount)}
          sub={fermentingCount > 0 ? 'Tracking gravity & temp' : 'None tracking'}
          icon={MdScience}
          accent={ACCENT.info}
        />
      </Grid>

      <Grid templateColumns={{ base: '1fr', lg: '1.7fr 1fr' }} gap="18px" alignItems="start">
        <GridItem>
          <Card p="6px" gap={0}>
            <Text
              px="16px"
              pt="14px"
              pb="8px"
              fontSize="13px"
              fontWeight="700"
              color="ink.textMuted"
              textTransform="uppercase"
              letterSpacing="0.5px"
            >
              Ongoing Brews
            </Text>
            {ongoingBrews.length === 0 ? (
              <Box px="16px" pb="18px">
                <Text fontSize="14px" color="ink.textFaint">
                  No active brews right now.
                </Text>
              </Box>
            ) : (
              ongoingBrews.map((batch) => {
                const live = batch.session ? liveBySession[batch.session.id] : undefined;
                const statusText =
                  batch.phase === BatchPhase.CARBONATING
                    ? batch.carbMethod ?? 'Carbonating'
                    : live?.step ?? batch.session?.statusText ?? phaseLabel(batch.phase);
                return (
                  <Link
                    key={batch.id}
                    to={`/sessions/${batch.session?.id ?? ''}`}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <Flex
                      align="center"
                      justify="space-between"
                      gap="14px"
                      px="16px"
                      py="14px"
                      borderTop="1px solid"
                      borderColor="ink.divider"
                      wrap="wrap"
                    >
                      <HStack spacing="14px" flex="1" minW="0">
                        <Flex
                          w="40px"
                          h="40px"
                          borderRadius="10px"
                          bg={`oklch(${phaseAccent(batch.phase)} / 0.15)`}
                          align="center"
                          justify="center"
                          flex="0 0 auto"
                        >
                          <Icon as={GiHops} boxSize="20px" color={`oklch(${phaseAccent(batch.phase)})`} />
                        </Flex>
                        <Box minW="0" flex="1">
                          <Text fontSize="16px" fontWeight="700" noOfLines={1}>
                            {batch.name}
                          </Text>
                          <HStack spacing="8px" mt="3px">
                            <HStack
                              spacing="6px"
                              fontSize="11px"
                              fontWeight="700"
                              px="9px"
                              py="2px"
                              borderRadius="999px"
                              bg={`oklch(${phaseAccent(batch.phase)} / 0.15)`}
                              color={`oklch(${phaseAccent(batch.phase)})`}
                            >
                              <Box
                                w="6px"
                                h="6px"
                                borderRadius="full"
                                bg={`oklch(${phaseAccent(batch.phase)})`}
                                sx={{ animation: 'pulse-dot 1.6s infinite' }}
                              />
                              <Text>{phaseLabel(batch.phase)}</Text>
                            </HStack>
                            <Text fontSize="12px" color="ink.textFaint" noOfLines={1}>
                              {statusText}
                            </Text>
                          </HStack>
                        </Box>
                      </HStack>
                      <HStack spacing="22px" flex="0 0 auto">
                        {batch.needsAttention && (
                          <Tooltip label="Needs your input to continue" fontSize="12px">
                            <Flex>
                              <Icon as={MdWarning} boxSize="15px" color="orange.400" />
                            </Flex>
                          </Tooltip>
                        )}
                        <Box textAlign="right">
                          <Text fontSize="11px" color="ink.textFaint">
                            Progress
                          </Text>
                          <Text fontFamily="mono" fontSize="20px" fontWeight="700" color="brand.500">
                            {batch.progress}%
                          </Text>
                        </Box>
                        <Icon as={MdChevronRight} boxSize="16px" color="ink.textFaint" />
                      </HStack>
                    </Flex>
                  </Link>
                );
              })
            )}
          </Card>
        </GridItem>

        <GridItem>
          <Card p="20px">
            <Flex justify="space-between" align="center" mb="14px">
              <Text fontSize="14px" fontWeight="700">
                Recent Sessions
              </Text>
              <Link to="/sessions">
                <Text fontSize="12px" color="brand.500" cursor="pointer">
                  View all
                </Text>
              </Link>
            </Flex>
            {recentBatches.length === 0 ? (
              <Text fontSize="13px" color="ink.textFaint">
                No completed sessions yet
              </Text>
            ) : (
              recentBatches.map((batch) => (
                <Link key={batch.id} to="/sessions" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <HStack spacing="12px" py="10px" borderTop="1px solid" borderColor="ink.divider">
                    <Flex
                      w="32px"
                      h="32px"
                      borderRadius="7px"
                      bg="ink.bg"
                      align="center"
                      justify="center"
                      flex="0 0 auto"
                    >
                      <Icon as={IoIosBeer} boxSize="15px" color="ink.textMuted" />
                    </Flex>
                    <Box flex="1" minW="0">
                      <Text fontSize="13px" fontWeight="600" noOfLines={1}>
                        {batch.name}
                      </Text>
                      <Text fontSize="11px" color="ink.textFaint">
                        {formatDate(batch.updatedAt)}
                      </Text>
                    </Box>
                    <Text
                      fontSize="11px"
                      fontWeight="700"
                      color={batch.phase === BatchPhase.CANCELED ? 'danger.500' : 'success.500'}
                    >
                      {phaseLabel(batch.phase)}
                    </Text>
                  </HStack>
                </Link>
              ))
            )}
          </Card>
        </GridItem>
      </Grid>
    </>
  );
};
