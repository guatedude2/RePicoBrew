import { Box, ChakraProvider, Heading, Text } from '@chakra-ui/react';
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError,
} from '@remix-run/react';
import { StrictMode } from 'react';
import theme from './theme/theme';

function Document({ children, title = 'RePicoBrew' }: { children: React.ReactNode; title?: string }) {
  return (
    <html lang="en">
      <head>
        <Meta />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="theme-color" content="#000000" />
        <title>{title}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,700;1,400;1,500;1,700&display=swap"
        />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <Document>
      <ChakraProvider theme={theme}>
        <StrictMode>
          <Outlet />
        </StrictMode>
      </ChakraProvider>
    </Document>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <Document title={`${error.status} ${error.statusText}`}>
        <ChakraProvider theme={theme}>
          <StrictMode>
            <Box>
              <Heading as="h1" bg="purple.600">
                [CatchBoundary]: {error.status} {error.statusText}
              </Heading>
              <Text as="pre">{error.data.message}</Text>
            </Box>
          </StrictMode>
        </ChakraProvider>
      </Document>
    );
  }

  let errorMessage = 'Unknown error';
  let trace: string | undefined;
  if (error instanceof Error) {
    errorMessage = error.message;
    trace = error.stack;
  }

  return (
    <Document title="Error!">
      <ChakraProvider theme={theme}>
        <StrictMode>
          <Box>
            <Heading as="h1" bg="blue.500">
              [ErrorBoundary]: There was an error: {errorMessage}
            </Heading>
            <Text as="pre">{trace}</Text>
          </Box>
        </StrictMode>
      </ChakraProvider>
    </Document>
  );
}
