import type { LoaderArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import {
  Box,
  Badge,
  Flex,
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
  HStack,
} from '@chakra-ui/react';
import { MdHistory, MdVisibility } from 'react-icons/md';
import Card from '~/components/card/Card';
import { SessionRepository, SessionState } from '~/repositories/session.server';

export const meta = () => [{ title: 'Sessions | RePicoBrew' }];

export const loader = async (_args: LoaderArgs) => {
  const sessions = await SessionRepository.listSessions({ limit: 100 });
  return json({ sessions });
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

const getStateName = (state: SessionState): string => {
  switch (state) {
    case SessionState.COMPLETED:
      return 'Completed';
    case SessionState.IN_PROGRESS:
      return 'In Progress';
    case SessionState.CANCELED:
      return 'Canceled';
    case SessionState.READY:
      return 'Ready';
    default:
      return 'Unknown';
  }
};

export default function SessionsPage() {
  const { sessions } = useLoaderData<typeof loader>();
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.100');
  const textColor = useColorModeValue('secondaryGray.900', 'white');

  return (
    <Box pt={{ base: '130px', md: '80px', xl: '80px' }}>
      <Card alignItems="center" flexDirection="column" w="100%">
        <Flex direction="column" alignItems="flex-start" w="100%" px="15px" py="10px">
          <Flex w="100%" justify="space-between" align="center" mb={4}>
            <HStack>
              <Icon as={MdHistory} w={6} h={6} color="brand.500" />
              <Text fontSize="xl" fontWeight="700" lineHeight="100%">
                Brew Sessions
              </Text>
            </HStack>
          </Flex>

          {sessions.length === 0 ? (
            <Flex w="100%" justify="center" align="center" py={8} direction="column">
              <Icon as={MdHistory} w={12} h={12} color="gray.400" mb={4} />
              <Text color="secondaryGray.600">No sessions yet</Text>
              <Text fontSize="sm" color="secondaryGray.500" mt={2}>
                Start a brew on your Pico device
              </Text>
            </Flex>
          ) : (
            <Box w="100%" overflowX="auto">
              <Table variant="simple" color="gray.500" mt={4}>
                <Thead>
                  <Tr>
                    <Th borderColor={borderColor}>Date</Th>
                    <Th borderColor={borderColor}>Recipe</Th>
                    <Th borderColor={borderColor}>Device</Th>
                    <Th borderColor={borderColor}>Status</Th>
                    <Th borderColor={borderColor}>Logs</Th>
                    <Th borderColor={borderColor}>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {sessions.map((session) => (
                    <Tr key={session.id}>
                      <Td borderColor={borderColor}>
                        <Text color={textColor} fontSize="sm">
                          {new Date(session.createdAt).toLocaleString()}
                        </Text>
                      </Td>
                      <Td borderColor={borderColor}>
                        <Text color={textColor} fontSize="sm" fontWeight="700">
                          {session.recipe?.name || 'Custom'}
                        </Text>
                      </Td>
                      <Td borderColor={borderColor}>
                        <Text color={textColor} fontSize="sm">
                          {session.device?.name || 'Unknown'}
                        </Text>
                      </Td>
                      <Td borderColor={borderColor}>
                        <VStack align="start" spacing={1}>
                          <Badge colorScheme={getStateColor(session.state)}>{getStateName(session.state)}</Badge>
                          <Text fontSize="xs" color="secondaryGray.600">
                            {session.statusText}
                          </Text>
                        </VStack>
                      </Td>
                      <Td borderColor={borderColor}>
                        <Text color={textColor} fontSize="sm">
                          {session._count.logs} entries
                        </Text>
                      </Td>
                      <Td borderColor={borderColor}>
                        <Link to={`/sessions/${session.id}`}>
                          <HStack as="button" spacing={1} color="brand.500" _hover={{ textDecoration: 'underline' }}>
                            <Icon as={MdVisibility} />
                            <Text fontSize="sm">View</Text>
                          </HStack>
                        </Link>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          )}
        </Flex>
      </Card>
    </Box>
  );
}
