import {
  Box,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerOverlay,
  Flex,
  HStack,
  Icon,
  Text,
  useDisclosure,
} from '@chakra-ui/react';
import { Link, useLocation } from 'react-router';
import type { FC } from 'react';
import { IoMenuOutline } from 'react-icons/io5';
import type { NavItem } from '~/layouts/nav';

const Logo: FC = () => (
  <Flex align="center" gap="10px">
    <Flex
      w="34px"
      h="34px"
      borderRadius="8px"
      bgGradient="linear(155deg, brand.300, brand.600)"
      align="center"
      justify="center"
      flex="0 0 auto"
    >
      <Icon viewBox="0 0 24 24" boxSize="18px" color="ink.onBrand">
        <path d="M6 3h10l1 4H5l1-4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path
          d="M5 7h14l-1.4 12.2A2 2 0 0 1 15.6 21H8.4a2 2 0 0 1-2-1.8L5 7z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </Icon>
    </Flex>
    <Box lineHeight="1.1">
      <Text fontWeight="700" fontSize="15px" letterSpacing="0.5px">
        REPICOBREW
      </Text>
      <Text fontSize="11px" color="ink.textFaint" letterSpacing="1px">
        CONTROL DECK
      </Text>
    </Box>
  </Flex>
);

const NavSection: FC<{ label: string; items: NavItem[]; pathname: string }> = ({ label, items, pathname }) => (
  <>
    <Text fontSize="11px" fontWeight="600" letterSpacing="1px" color="ink.textFaintest" px="12px" pt="16px" pb="6px">
      {label}
    </Text>
    {items.map((item) => {
      const isActive = pathname.startsWith(item.path);
      return (
        <Link key={item.path} to={item.path} style={{ textDecoration: 'none' }}>
          <HStack
            spacing="12px"
            px="12px"
            py="10px"
            borderRadius="8px"
            bg={isActive ? 'brand.100' : 'transparent'}
            borderLeft="3px solid"
            borderLeftColor={isActive ? 'brand.500' : 'transparent'}
            color={isActive ? 'ink.text' : 'ink.textMuted'}
            fontWeight={isActive ? '600' : '500'}
            fontSize="14px"
            _hover={{ color: 'ink.text' }}
          >
            {item.icon}
            <Text>{item.name}</Text>
          </HStack>
        </Link>
      );
    })}
  </>
);

const SidebarBody: FC<{ pathname: string; routes: NavItem[] }> = ({ pathname, routes }) => {
  const brewing = routes.filter((r) => r.section === 'BREWING');
  const system = routes.filter((r) => r.section === 'SYSTEM');
  return (
    <Flex direction="column" h="100%">
      <Box px="20px" py="24px" borderBottom="1px solid" borderColor="ink.border">
        <Logo />
      </Box>
      <Flex direction="column" flex="1" px="12px" py="16px" gap="2px" overflowY="auto">
        <NavSection label="BREWING" items={brewing} pathname={pathname} />
        <NavSection label="SYSTEM" items={system} pathname={pathname} />
      </Flex>
    </Flex>
  );
};

export function Sidebar({ routes }: { routes: NavItem[] }) {
  const { pathname } = useLocation();

  return (
    <Box
      display={{ base: 'none', md: 'block' }}
      w="240px"
      flex="0 0 240px"
      bg="ink.sidebar"
      borderRight="1px solid"
      borderColor="ink.border"
      position="sticky"
      top="0"
      h="100vh"
    >
      <SidebarBody pathname={pathname} routes={routes} />
    </Box>
  );
}

export function SidebarDrawer({ routes }: { routes: NavItem[] }) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { pathname } = useLocation();

  return (
    <Box display={{ base: 'block', md: 'none' }}>
      <Icon as={IoMenuOutline} boxSize="24px" color="ink.text" onClick={onOpen} cursor="pointer" />
      <Drawer isOpen={isOpen} onClose={onClose} placement="left">
        <DrawerOverlay />
        <DrawerContent bg="ink.sidebar" maxW="240px">
          <DrawerCloseButton color="ink.textSecondary" zIndex={2} />
          <DrawerBody p="0">
            <SidebarBody pathname={pathname} routes={routes} />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Box>
  );
}

export default Sidebar;
