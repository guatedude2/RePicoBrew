import { Icon } from '@chakra-ui/react';
import { GiCookingPot } from 'react-icons/gi';
import { IoIosBeer, IoMdSettings } from 'react-icons/io';
import { MdSpaceDashboard } from 'react-icons/md';

export interface NavItem {
  name: string;
  icon: JSX.Element | string;
  path: string;
  section: 'BREWING' | 'SYSTEM';
}

const routes: NavItem[] = [
  {
    name: 'Dashboard',
    path: '/dashboard',
    icon: <Icon as={MdSpaceDashboard} width="18px" height="18px" color="inherit" />,
    section: 'BREWING',
  },
  {
    name: 'Sessions',
    path: '/sessions',
    icon: <Icon as={GiCookingPot} width="18px" height="18px" color="inherit" />,
    section: 'BREWING',
  },
  {
    name: 'Recipes',
    icon: <Icon as={IoIosBeer} width="18px" height="18px" color="inherit" />,
    path: '/recipes',
    section: 'BREWING',
  },
  {
    name: 'Settings',
    path: '/settings',
    icon: <Icon as={IoMdSettings} width="18px" height="18px" color="inherit" />,
    section: 'SYSTEM',
  },
];

export default routes;
