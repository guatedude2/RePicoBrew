import { Box, Flex, Icon, Text } from '@chakra-ui/react';
import type { FC } from 'react';
import type { IconType } from 'react-icons';

// oklch channel triples (no wrapping fn) so tinted/solid variants can be composed per stat card
export const ACCENT = {
  brand: '0.78 0.135 65',
  success: '0.72 0.14 145',
  info: '0.72 0.1 235',
  danger: '0.7 0.16 25',
  purple: '0.65 0.15 300',
};

export const StatCard: FC<{
  label: string;
  value: string;
  unit?: string;
  sub: string;
  icon: IconType;
  accent: string;
}> = ({ label, value, unit, sub, icon, accent }) => (
  <Box
    bg="ink.card"
    border="1px solid"
    borderColor="ink.cardBorder"
    borderRadius="12px"
    p="18px"
    position="relative"
    overflow="hidden"
  >
    <Box
      position="absolute"
      top={0}
      left={0}
      right={0}
      h="2px"
      bgGradient={`linear(to-r, transparent, oklch(${accent}), transparent)`}
      opacity={0.7}
    />
    <Flex align="center" justify="space-between">
      <Text fontSize="12px" fontWeight="600" letterSpacing="0.4px" color="ink.textFaint" textTransform="uppercase">
        {label}
      </Text>
      <Flex w="30px" h="30px" borderRadius="7px" bg={`oklch(${accent} / 0.15)`} align="center" justify="center">
        <Icon as={icon} boxSize="16px" color={`oklch(${accent})`} />
      </Flex>
    </Flex>
    <Text fontFamily="mono" fontSize="26px" fontWeight="600" mt="10px">
      {value}
      {unit && (
        <Text as="span" fontSize="15px" color="ink.textDim">
          {unit}
        </Text>
      )}
    </Text>
    <Text fontSize="12px" color="ink.textFaint" mt="0.5">
      {sub}
    </Text>
  </Box>
);
