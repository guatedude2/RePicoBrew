import {
  Box,
  Button,
  Flex,
  Grid,
  Icon,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Text,
} from '@chakra-ui/react';
import type { FC } from 'react';
import { MdAdd, MdDeleteOutline } from 'react-icons/md';
import { PicoLocationMap } from '~/types';

export type MachineStepRow = {
  id: string;
  name: string;
  temperature: number;
  stepTime: number;
  drainTime: number;
  location: number;
};

const LOCATION_OPTIONS = Object.entries(PicoLocationMap)
  .filter(([key]) => Number.isNaN(Number(key)))
  .map(([label, value]) => ({ label, value: value as number }));

const columns = '36px 1.6fr 1fr 0.8fr 0.8fr 0.8fr';

const fieldStyle = {
  bg: 'ink.bg',
  border: '1px solid',
  borderColor: 'ink.cardBorder',
  borderRadius: '6px',
  fontSize: '13px',
  h: '34px',
};

export const MachineStepsModal: FC<{
  isOpen: boolean;
  onClose: () => void;
  steps: MachineStepRow[];
  onChange: (steps: MachineStepRow[]) => void;
  readOnly?: boolean;
}> = ({ isOpen, onClose, steps, onChange, readOnly = false }) => {
  const update = (id: string, field: keyof MachineStepRow, value: string | number) => {
    onChange(steps.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };
  const insertAfter = (index: number) => {
    const next = [...steps];
    next.splice(index + 1, 0, {
      id: Math.random().toString(36).slice(2),
      name: 'New Step',
      temperature: 152,
      stepTime: 10,
      drainTime: 0,
      location: PicoLocationMap.Adjunct1,
    });
    onChange(next);
  };
  const remove = (id: string) => onChange(steps.filter((s) => s.id !== id));
  const rowTemplateColumns = readOnly ? columns : `${columns} 64px`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl">
      <ModalOverlay />
      <ModalContent maxH="85vh">
        <ModalHeader>
          <Text fontSize="16px" fontWeight="700">
            Advanced Recipe Control Program Editor
          </Text>
          <Text fontSize="12px" color="ink.textFaint" fontWeight="400" mt="2px">
            Raw firmware steps run by the Pico — edit with care.
          </Text>
        </ModalHeader>
        <ModalBody overflowY="auto">
          <Grid
            templateColumns={rowTemplateColumns}
            gap="8px"
            fontSize="11px"
            fontWeight="700"
            color="ink.textFaintest"
            textTransform="uppercase"
            pb="8px"
          >
            <Text>#</Text>
            <Text>Name</Text>
            <Text>Location</Text>
            <Text>Temp °F</Text>
            <Text>Time min</Text>
            <Text>Drain min</Text>
            {!readOnly && <Text>Insert/Del</Text>}
          </Grid>
          {steps.map((row, index) => (
            <Grid
              key={row.id}
              templateColumns={rowTemplateColumns}
              gap="8px"
              alignItems="center"
              py="6px"
              bg={index % 2 ? 'ink.bg' : 'transparent'}
            >
              <Text fontFamily="mono" fontSize="12px" color="ink.textFaint" textAlign="center">
                {index}
              </Text>
              <Input
                value={row.name}
                isReadOnly={readOnly || index < 3}
                onChange={(e) => update(row.id, 'name', e.target.value)}
                {...fieldStyle}
              />
              <Select
                value={row.location}
                isDisabled={readOnly || index < 3}
                onChange={(e) => update(row.id, 'location', Number(e.target.value))}
                {...fieldStyle}
              >
                {LOCATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
              <Input
                type="number"
                value={row.temperature}
                isReadOnly={readOnly}
                onChange={(e) => update(row.id, 'temperature', Number(e.target.value))}
                fontFamily="mono"
                {...fieldStyle}
              />
              <Input
                type="number"
                value={row.stepTime}
                isReadOnly={readOnly}
                onChange={(e) => update(row.id, 'stepTime', Number(e.target.value))}
                fontFamily="mono"
                {...fieldStyle}
              />
              <Input
                type="number"
                value={row.drainTime}
                isReadOnly={readOnly}
                onChange={(e) => update(row.id, 'drainTime', Number(e.target.value))}
                fontFamily="mono"
                {...fieldStyle}
              />
              {!readOnly && (
                <Flex gap="4px">
                  <Box
                    as="button"
                    type="button"
                    onClick={() => insertAfter(index)}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    w="26px"
                    h="26px"
                    borderRadius="6px"
                    bg="ink.card"
                    color="ink.textSecondary"
                    _hover={{ bg: 'ink.cardHover' }}
                  >
                    <Icon as={MdAdd} boxSize="13px" />
                  </Box>
                  {index >= 3 && (
                    <Box
                      as="button"
                      type="button"
                      onClick={() => remove(row.id)}
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      w="26px"
                      h="26px"
                      borderRadius="6px"
                      bg="ink.card"
                      color="danger.500"
                      _hover={{ bg: 'ink.cardHover' }}
                    >
                      <Icon as={MdDeleteOutline} boxSize="13px" />
                    </Box>
                  )}
                </Flex>
              )}
            </Grid>
          ))}
        </ModalBody>
        <ModalFooter gap="10px">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="brand" onClick={onClose}>
            Done
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
