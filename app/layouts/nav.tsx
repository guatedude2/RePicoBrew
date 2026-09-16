import { Icon } from '@chakra-ui/react';
import { GiCookingPot } from 'react-icons/gi';
import { IoIosBeer, IoMdSettings } from 'react-icons/io';
import { MdSpaceDashboard } from 'react-icons/md';

export interface NavItem {
  name: string;
  icon: JSX.Element | string;
  path: string;
  secondary?: boolean;
}

const routes: NavItem[] = [
  {
    name: 'Dashboard',
    path: '/dashboard',
    icon: <Icon as={MdSpaceDashboard} width="20px" height="20px" color="inherit" />,
  },
  {
    name: 'Sessions',
    path: '/sessions',
    icon: <Icon as={GiCookingPot} width="20px" height="20px" color="inherit" />,
    secondary: true,
  },
  {
    name: 'Recipes',
    icon: <Icon as={IoIosBeer} width="20px" height="20px" color="inherit" />,
    path: '/recipes',
  },
  {
    name: 'Settings',
    path: '/settings',
    icon: <Icon as={IoMdSettings} width="20px" height="20px" color="inherit" />,
  },
];

export default routes;
