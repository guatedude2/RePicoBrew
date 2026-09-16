import type { LoaderArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import {
  Badge,
  Box,
  Card,
  CardBody,
  Flex,
  Heading,
  Icon,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
  VStack,
} from '@chakra-ui/react';
import { MdScience, MdHistory } from 'react-icons/md';
import { SessionRepository, SessionState } from '~/repositories/session.server';

export async function loader(_args: LoaderArgs) {
  const sessions = await SessionRepository.listSessions({ limit: 100 });
  const fermentationSessions = sessions.filter((s) => s.type === 3 && s.state === SessionState.COMPLETED);

  return json({ sessions: fermentationSessions });
}

export default function FermentationHistoryRoute() {
  const { sessions } = useLoaderData<typeof loader>();
  const bgCard = useColorModeValue('white', 'navy.800');
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.100');
  const hoverBg = useColorModeValue('gray.50', 'whiteAlpha.50');

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

  return (
    <Box pt={{ base: '130px', md: '80px', xl: '80px' }}>
      <VStack align="start" spacing={0} mb={6}>
        <Heading size="lg" color={textColor}>
          <Icon as={MdHistory} mr={2} />
          Fermentation History
        </Heading>
        <Text color="secondaryGray.600" fontSize="sm">
          View past fermentation sessions
        </Text>
      </VStack>

      <Card bg={bgCard}>
        <CardBody>
          {sessions.length === 0 ? (
            <VStack spacing={4} py={8}>
              <Icon as={MdScience} w={16} h={16} color="gray.400" />
              <Text color="secondaryGray.600">No completed fermentation sessions yet</Text>
            </VStack>
          ) : (
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th borderColor={borderColor}>Device</Th>
                  <Th borderColor={borderColor}>Started</Th>
                  <Th borderColor={borderColor}>Completed</Th>
                  <Th borderColor={borderColor}>Duration</Th>
                  <Th borderColor={borderColor}>Readings</Th>
                  <Th borderColor={borderColor}>Status</Th>
                </Tr>
              </Thead>
              <Tbody>
                {sessions.map((session) => (
                  <Tr key={session.id} _hover={{ bg: hoverBg }}>
                    <Td borderColor={borderColor}>
                      <Link to={`/sessions/${session.id}`}>
                        <Flex align="center" gap={2}>
                          <Text color={textColor} fontWeight="600">
                            {session.device.name}
                          </Text>
                          {session.device.color && (
                            <Badge colorScheme={session.device.color.toLowerCase()}>{session.device.color}</Badge>
                          )}
                        </Flex>
                      </Link>
                    </Td>
                    <Td borderColor={borderColor}>
                      <Text color={textColor} fontSize="sm">
                        {new Date(session.createdAt).toLocaleString()}
                      </Text>
                    </Td>
                    <Td borderColor={borderColor}>
                      <Text color={textColor} fontSize="sm">
                        {new Date(session.updatedAt).toLocaleString()}
                      </Text>
                    </Td>
                    <Td borderColor={borderColor}>
                      <Text color={textColor} fontSize="sm">
                        {formatDuration(session.createdAt, session.updatedAt)}
                      </Text>
                    </Td>
                    <Td borderColor={borderColor}>
                      <Text color={textColor} fontSize="sm">
                        {session._count.logs} points
                      </Text>
                    </Td>
                    <Td borderColor={borderColor}>
                      <Badge colorScheme="green">{session.statusText}</Badge>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </CardBody>
      </Card>
    </Box>
  );
}
