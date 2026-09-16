import { Flex, Link, List, ListItem, Text } from '@chakra-ui/react';
import type { FC } from 'react';
import { version } from '../../../package.json';

export const FooterFullPage: FC = () => {
  const textColor = 'gray.400';
  const linkColor = 'white';
  return (
    <Flex
      zIndex="3"
      flexDirection={{
        base: 'column',
        lg: 'row',
      }}
      alignItems={{
        base: 'center',
        xl: 'start',
      }}
      justifyContent="space-between"
      px={{ base: '30px', md: '0px' }}
      pb="30px"
    >
      <Text
        color={textColor}
        textAlign={{
          base: 'center',
          xl: 'start',
        }}
        mb={{ base: '20px', lg: '0px' }}
      >
        {' '}
        <Text as="span" fontSize="12px" fontWeight="500" ms="4px">
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
          <Link fontWeight="500" color={linkColor} href="https://github.com/guatedude2/RePicoBrew/issues/new">
            Support
          </Link>
        </ListItem>
        <ListItem
          me={{
            base: '20px',
            md: '44px',
          }}
        >
          <Link fontWeight="500" color={linkColor} href="https://github.com/guatedude2/RePicoBrew">
            Github
          </Link>
        </ListItem>
        <ListItem>
          <Link fontWeight="500" color={linkColor} href="https://github.com/guatedude2/RePicoBrew/wiki">
            Help
          </Link>
        </ListItem>
      </List>
    </Flex>
  );
};
