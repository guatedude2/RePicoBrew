import { Flex, Image } from '@chakra-ui/react';
import { Link } from '@remix-run/react';
import { HSeparator } from '~/components/separator/Separator';

export function SidebarBrand() {
  return (
    <Flex alignItems="center" flexDirection="column">
      <Link to="/">
        <Image src="/img/logo.png" width="250px" mb="20px" />
      </Link>
      <HSeparator mb="20px" />
    </Flex>
  );
}

export default SidebarBrand;
