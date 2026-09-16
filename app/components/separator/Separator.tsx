import { Flex } from '@chakra-ui/react';

const HSeparator = (props: { variant?: string; [x: string]: any }) => (
  <Flex h="1px" w="100%" bg="rgba(135, 140, 189, 0.3)" {...props} />
);

const VSeparator = (props: { variant?: string; [x: string]: any }) => (
  <Flex w="1px" bg="rgba(135, 140, 189, 0.3)" {...props} />
);

export { HSeparator, VSeparator };
