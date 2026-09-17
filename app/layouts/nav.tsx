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
    icon: <MdSpaceDashboard className="size-[18px]" />,
    section: 'BREWING',
  },
  {
    name: 'Sessions',
    path: '/sessions',
    icon: <GiCookingPot className="size-[18px]" />,
    section: 'BREWING',
  },
  {
    name: 'Recipes',
    icon: <IoIosBeer className="size-[18px]" />,
    path: '/recipes',
    section: 'BREWING',
  },
  {
    name: 'Settings',
    path: '/settings',
    icon: <IoMdSettings className="size-[18px]" />,
    section: 'SYSTEM',
  },
];

export default routes;
