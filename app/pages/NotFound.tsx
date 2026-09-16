import { Box, Flex, Heading, Link, Text } from '@chakra-ui/react';
import { Link as ReLink } from '@remix-run/react';
import type { FC } from 'react';

export const NotFound: FC = () => (
  <Box pt={{ base: '130px', md: '80px', xl: '80px' }}>
    <Flex direction="column" align="center" justify="center" w="100%" h="80vh" px="15px" py="10px">
      <Heading as="h1">Oh uh. We didn't find that page.</Heading>
      <Text color="white" fontSize="xl" fontWeight="700" p={4} textAlign="center">
        Sorry, we couldn't find this page. But don't worry, you can find plenty of other things back in our{' '}
        <Link as={ReLink} to="/">
          homepage
        </Link>
        .
      </Text>
    </Flex>
  </Box>
);
