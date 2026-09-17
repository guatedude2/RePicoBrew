import { Flex, Icon, Text } from '@chakra-ui/react';
import type { FC, ReactNode } from 'react';
import type { IconType } from 'react-icons';

export const ErrorPage: FC<{
  icon: IconType;
  code: string;
  heading: string;
  description: string;
  accent: 'brand' | 'danger';
  minH?: string;
  children?: ReactNode;
}> = ({ icon, code, heading, description, accent, minH = '60vh', children }) => (
  <Flex
    direction="column"
    align="center"
    justify="center"
    minH={minH}
    w="100%"
    px="24px"
    py="24px"
    gap="22px"
    textAlign="center"
  >
    <Flex
      w="64px"
      h="64px"
      borderRadius="14px"
      align="center"
      justify="center"
      {...(accent === 'brand'
        ? { bgGradient: 'linear(155deg, brand.300, brand.600)' }
        : { bg: 'danger.100', border: '1px solid', borderColor: 'danger.500' })}
    >
      <Icon as={icon} boxSize="28px" color={accent === 'brand' ? 'ink.onBrand' : 'danger.500'} />
    </Flex>
    <Text fontFamily="mono" fontSize="64px" fontWeight="700" lineHeight="1" color={`${accent}.500`}>
      {code}
    </Text>
    <Flex direction="column" gap="6px" align="center">
      <Text fontSize="20px" fontWeight="700" color="ink.text">
        {heading}
      </Text>
      <Text fontSize="14px" color="ink.textDim" maxW="380px">
        {description}
      </Text>
    </Flex>
    <Flex gap="12px">{children}</Flex>
  </Flex>
);
