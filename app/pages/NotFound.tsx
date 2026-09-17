import { Button } from '@chakra-ui/react';
import { Link as ReLink } from 'react-router';
import type { FC } from 'react';
import { GiHops } from 'react-icons/gi';
import { ErrorPage } from '~/components/ErrorPage';

export const NotFound: FC<{ minH?: string }> = ({ minH }) => (
  <ErrorPage
    icon={GiHops}
    accent="brand"
    code="404"
    heading="Page not found"
    description="The page you're looking for doesn't exist or may have been moved."
    minH={minH}
  >
    <Button as={ReLink} to="/dashboard" variant="brand">
      Back to Dashboard
    </Button>
  </ErrorPage>
);
