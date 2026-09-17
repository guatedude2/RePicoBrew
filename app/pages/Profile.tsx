import { Box, Flex, Text } from '@chakra-ui/react';
import { useRouteLoaderData } from '@remix-run/react';
import type { FC } from 'react';
import Card from '~/components/card/Card';

const ROLE_LABEL: Record<string, string> = {
  Regular: 'Regular User',
  ReadOnly: 'Read-only',
};

const initialsFor = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

const InfoRow: FC<{ label: string; value: string }> = ({ label, value }) => (
  <Flex
    justify="space-between"
    px="16px"
    py="12px"
    bg="ink.bg"
    borderTop="1px solid"
    borderColor="ink.divider"
    fontSize="13px"
    _first={{ borderTop: 'none' }}
  >
    <Text color="ink.textFaint">{label}</Text>
    <Text color="ink.text" fontWeight="600">
      {value}
    </Text>
  </Flex>
);

export const Profile: FC = () => {
  const adminData = useRouteLoaderData<typeof import('~/routes/_admin').loader>('routes/_admin');
  const session = adminData?.session;

  if (!session) {
    return null;
  }

  return (
    <Box maxW="480px" display="flex" flexDirection="column" gap="18px">
      <Text fontSize="26px" fontWeight="700" letterSpacing="-0.3px">
        My Profile
      </Text>

      <Card p="24px" display="flex" flexDirection="column" gap="18px">
        <Flex align="center" gap="16px">
          <Flex
            w="56px"
            h="56px"
            borderRadius="full"
            bgGradient="linear(155deg, gray.500, gray.700)"
            border="1px solid"
            borderColor="ink.borderStrong"
            align="center"
            justify="center"
            fontSize="18px"
            fontWeight="700"
            color="white"
            flex="0 0 auto"
          >
            {initialsFor(session.name)}
          </Flex>
          <Box>
            <Text fontSize="18px" fontWeight="700">
              {session.name}
            </Text>
            <Text fontSize="13px" color="ink.textFaint">
              {ROLE_LABEL[session.role] ?? session.role}
            </Text>
          </Box>
        </Flex>

        <Box
          display="flex"
          flexDirection="column"
          border="1px solid"
          borderColor="ink.divider"
          borderRadius="10px"
          overflow="hidden"
        >
          <InfoRow label="Name" value={session.name} />
          <InfoRow label="Email" value={session.email} />
          <InfoRow label="Role" value={ROLE_LABEL[session.role] ?? session.role} />
        </Box>
      </Card>
    </Box>
  );
};

export default Profile;
