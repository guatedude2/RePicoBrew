import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData, Link } from 'react-router';
import { Box, Flex, Grid, Icon, Text } from '@chakra-ui/react';
import { MdScience, MdHistory } from 'react-icons/md';
import Card from '~/components/card/Card';
import { SessionRepository } from '~/repositories/session.server';
import { SessionState } from '~/types';
import { serializeDates } from '~/utils/serialize.server';

export async function loader(_args: LoaderFunctionArgs) {
  const sessions = await SessionRepository.listSessions({ limit: 100 });
  const fermentationSessions = sessions.filter((s) => s.type === 3 && s.state === SessionState.COMPLETED);

  return serializeDates({ sessions: fermentationSessions });
}

const columns = '1.4fr 1.4fr 1.4fr 1fr 1fr 1fr';

const formatDuration = (startTime: string, endTime: string): string => {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const diff = end - start;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  return `${hours}h`;
};

export default function FermentationHistoryRoute() {
  const { sessions } = useLoaderData<typeof loader>();

  return (
    <>
      <Box>
        <Text fontSize="26px" fontWeight="700" letterSpacing="-0.3px">
          Fermentation History
        </Text>
        <Text fontSize="14px" color="ink.textDim" mt="4px">
          Review past fermentation sessions
        </Text>
      </Box>

      <Card overflow="hidden" p="0">
        {sessions.length === 0 ? (
          <Flex direction="column" align="center" gap="14px" py="48px">
            <Icon as={MdScience} boxSize="40px" color="ink.textFaint" />
            <Text color="ink.textFaint">No completed fermentation sessions yet</Text>
          </Flex>
        ) : (
          <>
            <Grid
              templateColumns={columns}
              px="20px"
              py="14px"
              fontSize="11px"
              fontWeight="700"
              letterSpacing="0.5px"
              color="ink.textFaint"
              textTransform="uppercase"
              borderBottom="1px solid"
              borderColor="ink.divider"
            >
              <Text>Device</Text>
              <Text>Started</Text>
              <Text>Completed</Text>
              <Text>Duration</Text>
              <Text>Readings</Text>
              <Text>Status</Text>
            </Grid>
            {sessions.map((session) => (
              <Grid
                key={session.id}
                templateColumns={columns}
                px="20px"
                py="16px"
                alignItems="center"
                borderBottom="1px solid"
                borderColor="ink.divider"
              >
                <Link to={`/sessions/${session.id}`}>
                  <Flex align="center" gap="8px">
                    <Icon as={MdHistory} boxSize="14px" color="brand.500" />
                    <Text fontSize="13px" fontWeight="700">
                      {session.device.name}
                    </Text>
                    {session.device.color && (
                      <Text fontSize="11px" color="ink.textFaint">
                        {session.device.color}
                      </Text>
                    )}
                  </Flex>
                </Link>
                <Text fontSize="13px" color="ink.textSecondary">
                  {new Date(session.createdAt).toLocaleString()}
                </Text>
                <Text fontSize="13px" color="ink.textSecondary">
                  {new Date(session.updatedAt).toLocaleString()}
                </Text>
                <Text fontSize="13px" color="ink.textSecondary">
                  {formatDuration(session.createdAt, session.updatedAt)}
                </Text>
                <Text fontSize="12px" color="ink.textFaint">
                  {session._count.logs} points
                </Text>
                <Text fontSize="11px" fontWeight="700" color="success.500">
                  {session.statusText}
                </Text>
              </Grid>
            ))}
          </>
        )}
      </Card>
    </>
  );
}
