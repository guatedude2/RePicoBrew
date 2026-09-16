import { NavLink, useLocation } from 'react-router-dom';
// chakra imports
import { Box, Flex, HStack, Text } from '@chakra-ui/react';
import type { NavItem } from '~/layouts/nav';

export function SidebarLinks(props: { routes: NavItem[] }) {
  //   Chakra color mode
  const location = useLocation();
  const brandColor = 'brand.400';

  const { routes } = props;

  // verifies if routeName is the one active (in browser input)
  const activeRoute = (routeName: string) => location.pathname.includes(routeName);

  // this function creates the links from the secondary accordions (for example auth -> sign-in -> default)
  const createLinks = (navRoutes: NavItem[]) =>
    navRoutes.map((route: NavItem) => (
      <NavLink key={route.path} to={route.path}>
        <Box>
          <HStack spacing={activeRoute(route.path.toLowerCase()) ? '22px' : '26px'} py="5px" ps="10px">
            <Flex w="100%" alignItems="center" justifyContent="center" color="white" _hover={{ color: 'brand.500' }}>
              <Flex align="center" justify="center" color="inherit" me="18px">
                {route.icon}
              </Flex>
              <Text me="auto" fontWeight={activeRoute(route.path.toLowerCase()) ? 'bold' : 'normal'}>
                {route.name}
              </Text>
            </Flex>
            <Box
              h="36px"
              w="4px"
              bg={activeRoute(route.path.toLowerCase()) ? brandColor : 'transparent'}
              borderRadius="5px"
            />
          </HStack>
        </Box>
      </NavLink>
    ));
  //  BRAND
  return <>{createLinks(routes)}</>;
}

export default SidebarLinks;
