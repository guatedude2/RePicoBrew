import { Flex } from '@chakra-ui/react';
import type { FC, PropsWithChildren } from 'react';

export const FullPageLayout: FC<PropsWithChildren> = ({ children }) => (
  <Flex position="relative" h="max-content">
    <Flex
      h={{
        sm: 'initial',
        md: 'unset',
        lg: '100vh',
        xl: '97vh',
      }}
      w="100%"
      maxW={{ md: '66%', lg: '1313px' }}
      mx="auto"
      pt={{ sm: '50px', md: '0px' }}
      px={{ lg: '30px', xl: '0px' }}
      ps={{ xl: '70px' }}
      justifyContent="start"
      direction="column"
    >
      {children}
    </Flex>
  </Flex>
);
