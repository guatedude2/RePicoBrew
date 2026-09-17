import { Box, Flex, HStack, Icon, Menu, MenuButton, MenuDivider, MenuItem, MenuList, Text } from '@chakra-ui/react';
import { Link as RemixLink, useFetcher, useLocation, useRouteLoaderData } from 'react-router';
import type { FC } from 'react';
import { MdCheckCircle, MdLogout, MdNotificationsNone, MdOutlinePerson, MdWarning } from 'react-icons/md';
import type { NavItem } from '~/layouts/nav';
import { SidebarDrawer } from '~/components/sidebar/Sidebar';
import { attentionMessage, phaseAccent } from '~/utils/batch-phase';

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

export const Topbar: FC<{ routes: NavItem[] }> = ({ routes }) => {
  const { pathname } = useLocation();
  const current = routes.find((r) => pathname.startsWith(r.path));
  const adminData = useRouteLoaderData<typeof import('~/routes/_admin').loader>('routes/_admin');
  const session = adminData?.session;
  const attentionBatches = adminData?.attentionBatches ?? [];
  const logoutFetcher = useFetcher();

  return (
    <Flex
      align="center"
      justify="space-between"
      px={{ base: '16px', md: '32px' }}
      py="18px"
      borderBottom="1px solid"
      borderColor="ink.border"
      position="sticky"
      top="0"
      bg="oklch(0.15 0.004 260 / 0.92)"
      backdropFilter="blur(6px)"
      zIndex={2}
      gap="16px"
      wrap="wrap"
    >
      <HStack spacing="14px">
        <SidebarDrawer routes={routes} />
        <Text fontSize="20px" fontWeight="700">
          {current?.name ?? 'RePicoBrew'}
        </Text>
      </HStack>
      <HStack spacing="14px">
        <Menu placement="bottom-end">
          <MenuButton
            position="relative"
            w="34px"
            h="34px"
            borderRadius="8px"
            bg="ink.card"
            border="1px solid"
            borderColor="ink.cardBorder"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Icon as={MdNotificationsNone} boxSize="16px" color="ink.textMuted" />
            {attentionBatches.length > 0 && (
              <Box
                position="absolute"
                top="-2px"
                right="-2px"
                w="8px"
                h="8px"
                borderRadius="full"
                bg="brand.500"
                border="1.5px solid"
                borderColor="ink.bg"
              />
            )}
          </MenuButton>
          <MenuList maxH="360px" overflowY="auto" minW="300px">
            <Box px="12px" py="8px">
              <Text fontWeight="700" fontSize="14px">
                Needs Attention
              </Text>
            </Box>
            <MenuDivider />
            {attentionBatches.length === 0 ? (
              <Flex direction="column" align="center" gap="6px" py="20px" px="12px">
                <Icon as={MdCheckCircle} boxSize="20px" color="success.500" />
                <Text fontSize="12px" color="ink.textFaint">
                  All caught up
                </Text>
              </Flex>
            ) : (
              attentionBatches.map((batch) => (
                <MenuItem
                  key={batch.id}
                  as={RemixLink}
                  to={batch.sessionId ? `/sessions/${batch.sessionId}` : '/sessions'}
                  icon={<Icon as={MdWarning} color="orange.400" />}
                  whiteSpace="normal"
                >
                  <Text fontSize="13px" fontWeight="600" noOfLines={1}>
                    {batch.name}
                  </Text>
                  <Text fontSize="11px" color={`oklch(${phaseAccent(batch.phase)})`}>
                    {attentionMessage(batch.phase)}
                  </Text>
                </MenuItem>
              ))
            )}
          </MenuList>
        </Menu>
        <Menu placement="bottom-end">
          <MenuButton
            w="34px"
            h="34px"
            borderRadius="full"
            bgGradient="linear(155deg, gray.500, gray.700)"
            border="1px solid"
            borderColor="ink.borderStrong"
            fontSize="13px"
            fontWeight="700"
            color="white"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            {session ? initialsFor(session.name) : ''}
          </MenuButton>
          <MenuList>
            {session && (
              <Box px="12px" py="8px">
                <Text fontWeight="700" fontSize="14px">
                  {session.name}
                </Text>
                <Text fontSize="12px" color="ink.textFaint">
                  {ROLE_LABEL[session.role] ?? session.role}
                </Text>
              </Box>
            )}
            <MenuDivider />
            <MenuItem as={RemixLink} to="/profile" icon={<Icon as={MdOutlinePerson} />}>
              My Profile
            </MenuItem>
            <MenuItem
              icon={<Icon as={MdLogout} />}
              color="danger.500"
              isDisabled={logoutFetcher.state !== 'idle'}
              onClick={() => logoutFetcher.submit({}, { method: 'post', action: '/logout' })}
            >
              Log Out
            </MenuItem>
          </MenuList>
        </Menu>
      </HStack>
    </Flex>
  );
};

export default Topbar;
