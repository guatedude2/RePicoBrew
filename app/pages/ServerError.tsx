import { Link as ReLink } from 'react-router';
import type { FC } from 'react';
import { MdWarning } from 'react-icons/md';
import { ErrorPage } from '~/components/ErrorPage';
import { Button } from '~/components/ui/button';

export const ServerError: FC<{ minH?: string }> = ({ minH }) => (
  <ErrorPage
    icon={MdWarning}
    accent="danger"
    code="500"
    heading="Something went wrong"
    description="A server error occurred while processing your request. Try again in a moment."
    minH={minH}
  >
    <Button variant="outline" onClick={() => window.location.reload()}>
      Retry
    </Button>
    <Button asChild variant="brand">
      <ReLink to="/dashboard">Back to Dashboard</ReLink>
    </Button>
  </ErrorPage>
);
