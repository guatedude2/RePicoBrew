import {
  Badge,
  Box,
  Button,
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
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  FormControl,
  FormLabel,
  Input,
  VStack,
  HStack,
} from '@chakra-ui/react';
import { useFetcher } from '@remix-run/react';
import { useState, type FC } from 'react';
import { MdCheckCircle, MdDevices } from 'react-icons/md';
import Card from '~/components/card/Card';
import { DeviceState } from '~/types';

type Device = {
  id: number;
  uid: string;
  name: string;
  deviceType: string;
  state: number;
  ipAddress: string | null;
  firmwareVersion: string | null;
  sessionCount: number;
  color: string | null; // Tilt color
  metadata: string | null; // JSON string
  createdAt: string;
  updatedAt: string;
  _count: {
    sessions: number;
  };
};

interface DevicesCardProps {
  devices: Device[];
}

const getTiltColorScheme = (color: string | null): string => {
  if (!color) {
    return 'gray';
  }
  const colorMap: Record<string, string> = {
    Red: 'red',
    Green: 'green',
    Black: 'gray',
    Purple: 'purple',
    Orange: 'orange',
    Blue: 'blue',
    Yellow: 'yellow',
    Pink: 'pink',
  };
  return colorMap[color] || 'gray';
};

const getStateLabel = (state: number): { label: string; color: string } => {
  switch (state) {
    case DeviceState.READY:
      return { label: 'Ready', color: 'green' };
    case DeviceState.BREWING:
      return { label: 'Brewing', color: 'blue' };
    case DeviceState.SOUS_VIDE:
      return { label: 'Sous Vide', color: 'purple' };
    case DeviceState.RACK_BEER:
      return { label: 'Rack Beer', color: 'orange' };
    case DeviceState.RINSE:
      return { label: 'Rinse', color: 'cyan' };
    case DeviceState.DEEP_CLEAN:
      return { label: 'Deep Clean', color: 'yellow' };
    case DeviceState.DE_SCALE:
      return { label: 'De-Scale', color: 'red' };
    default:
      return { label: 'Unknown', color: 'gray' };
  }
};

export const DevicesCard: FC<DevicesCardProps> = ({ devices }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [pendingUid, setPendingUid] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const fetcher = useFetcher();
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.100');
  const textColor = useColorModeValue('secondaryGray.900', 'white');

  const handleApprove = () => {
    fetcher.submit(
      {
        intent: 'approve-device',
        uid: pendingUid,
        name: deviceName,
      },
      { method: 'post' },
    );
    onClose();
    setPendingUid('');
    setDeviceName('');
  };

  return (
    <>
      <Card alignItems="center" flexDirection="column" w="100%" my={4}>
        <Flex direction="column" alignItems="flex-start" w="100%" px="15px" py="10px">
          <Flex w="100%" justify="space-between" align="center" mb={4}>
            <HStack>
              <Icon as={MdDevices} w={6} h={6} color="brand.500" />
              <Text fontSize="xl" fontWeight="700" lineHeight="100%">
                Devices
              </Text>
            </HStack>
            <Button
              leftIcon={<Icon as={MdCheckCircle} />}
              colorScheme="brand"
              size="sm"
              onClick={() => {
                setPendingUid('');
                setDeviceName('');
                onOpen();
              }}
            >
              Add Device
            </Button>
          </Flex>

          <Text mb={4} color="secondaryGray.600">
            Manage your PicoBrew and Tilt devices. New devices must be approved before use.
          </Text>

          {devices.length === 0 ? (
            <Flex w="100%" justify="center" align="center" py={8} direction="column">
              <Icon as={MdDevices} w={12} h={12} color="gray.400" mb={4} />
              <Text color="secondaryGray.600">No devices registered yet</Text>
              <Text fontSize="sm" color="secondaryGray.500" mt={2}>
                Power on your Pico or Tilt and connect to the network
              </Text>
            </Flex>
          ) : (
            <Box w="100%" overflowX="auto">
              <Table variant="simple" color="gray.500" mt={4}>
                <Thead>
                  <Tr>
                    <Th borderColor={borderColor}>Name</Th>
                    <Th borderColor={borderColor}>Type</Th>
                    <Th borderColor={borderColor}>Status</Th>
                    <Th borderColor={borderColor}>Details</Th>
                    <Th borderColor={borderColor}>Sessions</Th>
                    <Th borderColor={borderColor}>UID</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {devices.map((device) => {
                    const stateInfo = getStateLabel(device.state);
                    const isTilt = device.deviceType === 'TILT';
                    let metadata: any = {};
                    try {
                      metadata = device.metadata ? JSON.parse(device.metadata) : {};
                    } catch (e) {
                      // Ignore
                    }

                    return (
                      <Tr key={device.id}>
                        <Td borderColor={borderColor}>
                          <HStack>
                            <Text color={textColor} fontSize="sm" fontWeight="700">
                              {device.name}
                            </Text>
                            {isTilt && device.color && (
                              <Badge colorScheme={getTiltColorScheme(device.color)} fontSize="xs">
                                {device.color}
                              </Badge>
                            )}
                          </HStack>
                        </Td>
                        <Td borderColor={borderColor}>
                          <Text color={textColor} fontSize="sm">
                            {device.deviceType}
                          </Text>
                        </Td>
                        <Td borderColor={borderColor}>
                          {isTilt ? (
                            <Badge colorScheme="green">Active</Badge>
                          ) : (
                            <Badge colorScheme={stateInfo.color}>{stateInfo.label}</Badge>
                          )}
                        </Td>
                        <Td borderColor={borderColor}>
                          {isTilt ? (
                            <VStack align="start" spacing={0}>
                              {metadata.rssi !== undefined && (
                                <Text color={textColor} fontSize="xs">
                                  RSSI: {metadata.rssi} dBm
                                </Text>
                              )}
                              {metadata.lastSeen && (
                                <Text color="secondaryGray.600" fontSize="xs">
                                  {new Date(metadata.lastSeen).toLocaleString()}
                                </Text>
                              )}
                            </VStack>
                          ) : (
                            <VStack align="start" spacing={0}>
                              <Text color={textColor} fontSize="xs">
                                {device.ipAddress || '-'}
                              </Text>
                              <Text color="secondaryGray.600" fontSize="xs">
                                {device.firmwareVersion || '-'}
                              </Text>
                            </VStack>
                          )}
                        </Td>
                        <Td borderColor={borderColor}>
                          <Text color={textColor} fontSize="sm">
                            {device._count.sessions}
                          </Text>
                        </Td>
                        <Td borderColor={borderColor}>
                          <Text color="secondaryGray.600" fontSize="xs" fontFamily="mono">
                            {device.uid.substring(0, 12)}...
                          </Text>
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
            </Box>
          )}
        </Flex>
      </Card>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add Device</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Device UID</FormLabel>
                <Input
                  placeholder="32-character device ID"
                  value={pendingUid}
                  onChange={(e) => setPendingUid(e.target.value)}
                  fontFamily="mono"
                  maxLength={32}
                />
                <Text fontSize="xs" color="secondaryGray.500" mt={1}>
                  Found in register logs when device first connects
                </Text>
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Device Name</FormLabel>
                <Input
                  placeholder="e.g., Garage Pico"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="brand" onClick={handleApprove} isDisabled={!pendingUid || !deviceName}>
              Approve Device
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
