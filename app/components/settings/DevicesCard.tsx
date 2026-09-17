import {
  Box,
  Button,
  Flex,
  Icon,
  Text,
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

const ACCENT_COLOR = {
  success: 'oklch(0.72 0.14 145)',
  info: 'oklch(0.72 0.1 235)',
  danger: 'oklch(0.7 0.16 25)',
};

const getStateLabel = (state: number, isTilt: boolean): { label: string; accent: keyof typeof ACCENT_COLOR } => {
  if (isTilt) {
    return { label: 'ACTIVE', accent: 'success' };
  }
  switch (state) {
    case DeviceState.READY:
      return { label: 'READY', accent: 'success' };
    case DeviceState.BREWING:
      return { label: 'BREWING', accent: 'info' };
    default:
      return { label: 'ONLINE', accent: 'success' };
  }
};

export const DevicesCard: FC<DevicesCardProps> = ({ devices }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [pendingUid, setPendingUid] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const fetcher = useFetcher();

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
      <Card p="24px">
        <Flex justify="space-between" align="center" mb="14px">
          <Text fontSize="17px" fontWeight="700">
            Devices
          </Text>
          <Button leftIcon={<Icon as={MdCheckCircle} />} variant="brand" size="sm" onClick={() => onOpen()}>
            Add Device
          </Button>
        </Flex>

        {devices.length === 0 ? (
          <Flex direction="column" align="center" gap="8px" py="32px">
            <Icon as={MdDevices} boxSize="12" color="ink.textFaintest" />
            <Text color="ink.textFaint">No devices registered yet</Text>
            <Text fontSize="13px" color="ink.textFaintest">
              Power on your Pico or Tilt and connect to the network
            </Text>
          </Flex>
        ) : (
          devices.map((device) => {
            const isTilt = device.deviceType === 'TILT';
            const stateInfo = getStateLabel(device.state, isTilt);
            let metadata: any = {};
            try {
              metadata = device.metadata ? JSON.parse(device.metadata) : {};
            } catch {
              // ignore malformed metadata
            }

            return (
              <Flex key={device.id} align="center" gap="14px" py="12px" borderTop="1px solid" borderColor="ink.divider">
                <Box
                  w="9px"
                  h="9px"
                  borderRadius="full"
                  bg={ACCENT_COLOR[stateInfo.accent]}
                  boxShadow={`0 0 8px ${ACCENT_COLOR[stateInfo.accent]}`}
                />
                <Box flex="1">
                  <Text fontSize="14px" fontWeight="600">
                    {device.name}
                    {isTilt && device.color ? ` · ${device.color}` : ''}
                  </Text>
                  <Text fontSize="12px" color="ink.textFaint">
                    {device.uid.substring(0, 16)}
                    {isTilt && metadata.rssi !== undefined ? ` · ${metadata.rssi} dBm` : ''}
                    {!isTilt && device.ipAddress ? ` · ${device.ipAddress}` : ''}
                  </Text>
                </Box>
                <Text fontSize="11px" fontWeight="700" color={`${stateInfo.accent}.500`}>
                  {stateInfo.label}
                </Text>
              </Flex>
            );
          })
        )}
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
                <Text fontSize="xs" color="ink.textFaint" mt={1}>
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
            <Button variant="brand" onClick={handleApprove} isDisabled={!pendingUid || !deviceName}>
              Approve Device
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
