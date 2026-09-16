import { Flex, Link, List, ListItem, Text } from '@chakra-ui/react';
import { version } from '../../../package.json';

export default function Footer() {
  const textColor = 'white';
  return (
    <Flex
      zIndex="3"
      flexDirection={{
        base: 'column',
        xl: 'row',
      }}
      alignItems={{
        base: 'center',
        xl: 'start',
      }}
      justifyContent="space-between"
      px={{ base: '30px', md: '50px' }}
      pb="30px"
    >
      <Text
        color={textColor}
        textAlign={{
          base: 'center',
          xl: 'start',
        }}
        mb={{ base: '20px', xl: '0px' }}
      >
        {' '}
        <Text as="span" fontWeight="500" ms="4px">
          RePicoBrew v{version}
        </Text>
      </Text>
      <List display="flex">
        <ListItem
          me={{
            base: '20px',
            md: '44px',
          }}
        >
          <Link fontWeight="500" color={textColor} href="https://github.com/guatedude2/RePicoBrew/issues/new">
            Support
          </Link>
        </ListItem>
        <ListItem
          me={{
            base: '20px',
            md: '44px',
          }}
        >
          <Link fontWeight="500" color={textColor} href="https://github.com/guatedude2/RePicoBrew">
            Github
          </Link>
        </ListItem>
        <ListItem>
          <Link fontWeight="500" color={textColor} href="https://github.com/guatedude2/RePicoBrew/wiki">
            Help
          </Link>
        </ListItem>
      </List>
    </Flex>
  );
}
