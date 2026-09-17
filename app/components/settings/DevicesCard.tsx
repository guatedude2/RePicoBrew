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
} from '@chakra-ui/react';
import { useFetcher } from 'react-router';
import { useState, type FC } from 'react';
import { MdDevices } from 'react-icons/md';
import Card from '~/components/card/Card';
import { DEFAULT_ICON_FOR_TYPE, DeviceTypeIcon, type DeviceIconKind } from '~/components/settings/DeviceTypeIcon';
import { DeviceState, DeviceType } from '~/types';

type ModelOption = { id: DeviceIconKind; label: string; deviceType: DeviceType; disabled?: boolean };

const BREWING_OPTIONS: ModelOption[] = [
  { id: 'picoS', label: 'Pico S', deviceType: DeviceType.PICOBREW },
  { id: 'picoC', label: 'Pico C', deviceType: DeviceType.PICOBREW_C },
  { id: 'picoPro', label: 'Pico Pro', deviceType: DeviceType.PICOBREW },
  { id: 'zymatic', label: 'Zymatic', deviceType: DeviceType.ZYMATIC, disabled: true },
  { id: 'zseries', label: 'Z Series', deviceType: DeviceType.ZSERIES, disabled: true },
];

const FERMENTATION_OPTIONS: ModelOption[] = [
  { id: 'picoFerm', label: 'PicoFerm', deviceType: DeviceType.PICOFERM },
  { id: 'ispindel', label: 'iSpindel', deviceType: DeviceType.ISPINDEL },
  { id: 'tilt', label: 'Tilt', deviceType: DeviceType.TILT },
];

const ALL_OPTIONS = [...BREWING_OPTIONS, ...FERMENTATION_OPTIONS];

function parseJSON(value: string | null): Record<string, unknown> {
  if (!value) {
    return {};
  }
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

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

type DiscoveredDevice = {
  uid: string;
  deviceType: string | null;
  metadata: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
};

interface DevicesCardProps {
  devices: Device[];
  discoveredDevices: DiscoveredDevice[];
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

function deviceIconKind(device: Device): DeviceIconKind {
  const metadata = parseJSON(device.metadata);
  const modelIcon = metadata.modelIcon;
  if (typeof modelIcon === 'string' && ALL_OPTIONS.some((o) => o.id === modelIcon)) {
    return modelIcon as DeviceIconKind;
  }
  return DEFAULT_ICON_FOR_TYPE[device.deviceType as DeviceType] ?? 'picoC';
}

const ModelGrid: FC<{
  title: string;
  options: ModelOption[];
  selected: DeviceIconKind | null;
  onSelect: (option: ModelOption) => void;
}> = ({ title, options, selected, onSelect }) => (
  <Box>
    <Text
      fontSize="11px"
      fontWeight="700"
      letterSpacing="0.5px"
      color="ink.textFaint"
      textTransform="uppercase"
      mb="8px"
    >
      {title}
    </Text>
    <Flex gap="10px" wrap="wrap">
      {options.map((option) => {
        const isSelected = selected === option.id;
        return (
          <Flex
            key={option.id}
            direction="column"
            align="center"
            gap="6px"
            px="10px"
            py="10px"
            w="76px"
            borderRadius="10px"
            bg={isSelected ? 'brand.100' : 'ink.bg'}
            border="1px solid"
            borderColor={isSelected ? 'brand.500' : 'ink.cardBorder'}
            cursor={option.disabled ? 'not-allowed' : 'pointer'}
            opacity={option.disabled ? 0.4 : 1}
            onClick={() => !option.disabled && onSelect(option)}
          >
            <DeviceTypeIcon kind={option.id} size={30} color={isSelected ? 'brand.500' : 'ink.textSecondary'} />
            <Text
              fontSize="11px"
              fontWeight="600"
              color={isSelected ? 'ink.text' : 'ink.textSecondary'}
              textAlign="center"
            >
              {option.label}
            </Text>
          </Flex>
        );
      })}
    </Flex>
    {options.some((o) => o.disabled) && (
      <Text fontSize="11px" color="ink.textFaintest" mt="6px">
        Zymatic and Z Series aren&apos;t supported yet.
      </Text>
    )}
  </Box>
);

export const DevicesCard: FC<DevicesCardProps> = ({ devices, discoveredDevices }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [pairingTarget, setPairingTarget] = useState<DiscoveredDevice | null>(null);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<ModelOption | null>(null);
  const pairFetcher = useFetcher();
  const dismissFetcher = useFetcher();

  const openPairModal = (discovered: DiscoveredDevice) => {
    setPairingTarget(discovered);
    const metadata = parseJSON(discovered.metadata);
    setSelected(ALL_OPTIONS.find((o) => o.deviceType === discovered.deviceType) ?? null);
    setName(typeof metadata.name === 'string' ? metadata.name : '');
    onOpen();
  };

  const handlePair = () => {
    if (!pairingTarget || !name || !selected) {
      return;
    }
    const metadata = parseJSON(pairingTarget.metadata);
    pairFetcher.submit(
      {
        intent: 'pair-device',
        uid: pairingTarget.uid,
        name,
        deviceType: selected.deviceType,
        modelIcon: selected.id,
        ...(typeof metadata.color === 'string' ? { color: metadata.color } : {}),
      },
      { method: 'post' },
    );
    onClose();
  };

  const handleDismiss = (discoveredUid: string) => {
    dismissFetcher.submit({ intent: 'dismiss-discovered-device', uid: discoveredUid }, { method: 'post' });
  };

  return (
    <>
      <Card p="24px">
        <Text fontSize="17px" fontWeight="700">
          Devices
        </Text>
        <Text fontSize="13px" color="ink.textDim" mt="4px" mb="14px">
          Devices show up here automatically as they connect to your network — pair each one manually to give it a name
          before it can be used.
        </Text>

        {discoveredDevices.length > 0 && (
          <Box mb="18px" pb="18px" borderBottom="1px solid" borderColor="ink.divider">
            <Text fontSize="12px" fontWeight="700" color="ink.textFaint" textTransform="uppercase" mb="10px">
              Discovered Devices
            </Text>
            <Flex direction="column" gap="10px">
              {discoveredDevices.map((discovered) => (
                <Flex
                  key={discovered.uid}
                  align="center"
                  gap="14px"
                  p="14px"
                  borderRadius="10px"
                  border="1px dashed"
                  borderColor="brand.500"
                >
                  <Flex
                    align="center"
                    justify="center"
                    w="32px"
                    h="32px"
                    borderRadius="8px"
                    bg="ink.bg"
                    border="1px solid"
                    borderColor="ink.cardBorder"
                    flexShrink={0}
                  >
                    <DeviceTypeIcon
                      kind={
                        discovered.deviceType ? DEFAULT_ICON_FOR_TYPE[discovered.deviceType as DeviceType] : 'picoC'
                      }
                      size={20}
                      color="ink.textSecondary"
                    />
                  </Flex>
                  <Box flex="1" minW="0">
                    <Text fontSize="14px" fontWeight="700">
                      Discovered Device
                    </Text>
                    <Text fontSize="12px" color="ink.textFaint" fontFamily="mono" noOfLines={1}>
                      {discovered.uid}
                    </Text>
                  </Box>
                  <Button size="xs" w="76px" variant="outline" onClick={() => handleDismiss(discovered.uid)}>
                    Dismiss
                  </Button>
                  <Button size="xs" w="76px" variant="brand" onClick={() => openPairModal(discovered)}>
                    Pair
                  </Button>
                </Flex>
              ))}
            </Flex>
          </Box>
        )}

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
            const metadata = parseJSON(device.metadata);

            return (
              <Flex key={device.id} align="center" gap="14px" py="12px" borderTop="1px solid" borderColor="ink.divider">
                <Flex
                  align="center"
                  justify="center"
                  w="32px"
                  h="32px"
                  borderRadius="8px"
                  bg="ink.bg"
                  border="1px solid"
                  borderColor="ink.cardBorder"
                  flexShrink={0}
                >
                  <DeviceTypeIcon kind={deviceIconKind(device)} size={20} color="ink.textSecondary" />
                </Flex>
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
                <Box
                  w="9px"
                  h="9px"
                  borderRadius="full"
                  bg={ACCENT_COLOR[stateInfo.accent]}
                  boxShadow={`0 0 8px ${ACCENT_COLOR[stateInfo.accent]}`}
                />
                <Text fontSize="11px" fontWeight="700" color={`${stateInfo.accent}.500`}>
                  {stateInfo.label}
                </Text>
              </Flex>
            );
          })
        )}
      </Card>

      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            Pair Device
            {pairingTarget && (
              <Text fontSize="12px" fontWeight="500" fontFamily="mono" color="ink.textFaint" mt="2px">
                {pairingTarget.uid}
              </Text>
            )}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody display="flex" flexDirection="column" gap="16px">
            <ModelGrid
              title="Brewing Devices"
              options={BREWING_OPTIONS}
              selected={selected?.id ?? null}
              onSelect={setSelected}
            />
            <ModelGrid
              title="Fermentation Devices"
              options={FERMENTATION_OPTIONS}
              selected={selected?.id ?? null}
              onSelect={setSelected}
            />
            <FormControl isRequired>
              <FormLabel>Device Name</FormLabel>
              <Input placeholder="e.g., Garage Pico" value={name} onChange={(e) => setName(e.target.value)} />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button variant="brand" onClick={handlePair} isDisabled={!name || !selected}>
              Pair Device
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
