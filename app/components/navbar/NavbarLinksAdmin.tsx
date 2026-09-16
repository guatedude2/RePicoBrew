// Chakra Imports
import { Avatar, Button, Flex, Icon, Image, Link, Menu, MenuButton, MenuItem, MenuList, Text } from '@chakra-ui/react';
// Custom Components
import PropTypes from 'prop-types';
import { MdInfoOutline, MdNotificationsNone } from 'react-icons/md';
import nav from '../../layouts/nav';
import { ItemContent } from '../menu/ItemContent';
import { SidebarResponsive } from '../sidebar/Sidebar';
import { SearchBar } from './searchBar/SearchBar';
export default function HeaderLinks(props: { secondary: boolean }) {
  const { secondary } = props;
  // Chakra Color Mode
  const navbarIcon = 'white';
  const menuBg = 'background.400';
  const textColor = 'white';
  const textColorBrand = 'brand.400';
  const borderColor = 'rgba(135, 140, 189, 0.3)';
  const shadow = '14px 17px 40px 4px rgba(112, 144, 176, 0.06)';
  const borderButton = 'whiteAlpha.200';

  return (
    <Flex
      w={{ sm: '100%', md: 'auto' }}
      alignItems="center"
      flexDirection="row"
      bg={menuBg}
      flexWrap={secondary ? { base: 'wrap', md: 'nowrap' } : 'unset'}
      p="10px"
      borderRadius="30px"
      boxShadow={shadow}
    >
      <SearchBar
        mb={() => {
          if (secondary) {
            return { base: '10px', md: 'unset' };
          }
          return 'unset';
        }}
        me="10px"
        borderRadius="30px"
      />
      <SidebarResponsive routes={nav} />
      <Menu>
        <MenuButton p="0px">
          <Icon mt="6px" as={MdNotificationsNone} color={navbarIcon} w="18px" h="18px" me="10px" />
        </MenuButton>
        <MenuList
          boxShadow={shadow}
          p="20px"
          borderRadius="20px"
          bg={menuBg}
          border="none"
          mt="22px"
          me={{ base: '30px', md: 'unset' }}
          minW={{ base: 'unset', md: '400px', xl: '450px' }}
          maxW={{ base: '360px', md: 'unset' }}
        >
          <Flex w="100%" mb="20px">
            <Text fontSize="md" fontWeight="600" color={textColor}>
              Notifications
            </Text>
            <Text fontSize="sm" fontWeight="500" color={textColorBrand} ms="auto" cursor="pointer">
              Mark all read
            </Text>
          </Flex>
          <Flex flexDirection="column">
            <MenuItem px="0" borderRadius="8px" mb="10px">
              <ItemContent info="Horizon UI Dashboard PRO" />
            </MenuItem>
            <MenuItem px="0" borderRadius="8px" mb="10px">
              <ItemContent info="Horizon Design System Free" />
            </MenuItem>
          </Flex>
        </MenuList>
      </Menu>

      <Menu>
        <MenuButton p="0px">
          <Icon mt="6px" as={MdInfoOutline} color={navbarIcon} w="18px" h="18px" me="10px" />
        </MenuButton>
        <MenuList
          boxShadow={shadow}
          p="20px"
          me={{ base: '30px', md: 'unset' }}
          borderRadius="20px"
          bg={menuBg}
          border="none"
          mt="22px"
          minW={{ base: 'unset' }}
          maxW={{ base: '360px', md: 'unset' }}
        >
          <Image src="/img/layout/Navbar.png" borderRadius="16px" mb="28px" />
          <Flex flexDirection="column">
            <Link w="100%" href="https://horizon-ui.com/pro">
              <Button w="100%" h="44px" mb="10px" variant="brand">
                Buy Horizon UI PRO
              </Button>
            </Link>
            <Link w="100%" href="https://horizon-ui.com/documentation/docs/introduction">
              <Button w="100%" h="44px" mb="10px" border="1px solid" bg="transparent" borderColor={borderButton}>
                See Documentation
              </Button>
            </Link>
            <Link w="100%" href="https://github.com/horizon-ui/horizon-ui-chakra-ts">
              <Button w="100%" h="44px" variant="no-hover" color={textColor} bg="transparent">
                Try Horizon Free
              </Button>
            </Link>
          </Flex>
        </MenuList>
      </Menu>

      <Menu>
        <MenuButton p="0px">
          <Avatar
            _hover={{ cursor: 'pointer' }}
            color="white"
            name="Adela Parkson"
            bg="brand.500"
            size="sm"
            w="40px"
            h="40px"
          />
        </MenuButton>
        <MenuList boxShadow={shadow} p="0px" mt="10px" borderRadius="20px" bg={menuBg} border="none">
          <Flex w="100%" mb="0px">
            <Text
              ps="20px"
              pt="16px"
              pb="10px"
              w="100%"
              borderBottom="1px solid"
              borderColor={borderColor}
              fontSize="sm"
              fontWeight="700"
              color={textColor}
            >
              👋&nbsp; Hey, Adela
            </Text>
          </Flex>
          <Flex flexDirection="column" p="10px">
            <MenuItem borderRadius="8px" px="14px">
              <Text fontSize="sm">Profile Settings</Text>
            </MenuItem>
            <MenuItem borderRadius="8px" px="14px">
              <Text fontSize="sm">Newsletter Settings</Text>
            </MenuItem>
            <MenuItem color="red.400" borderRadius="8px" px="14px">
              <Text fontSize="sm">Log out</Text>
            </MenuItem>
          </Flex>
        </MenuList>
      </Menu>
    </Flex>
  );
}

HeaderLinks.propTypes = {
  variant: PropTypes.string,
  fixed: PropTypes.bool,
  secondary: PropTypes.bool,
  onOpen: PropTypes.func,
};
