import { ChakraProvider } from '@chakra-ui/react';
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
import { NotFound } from './pages/NotFound';
import { ServerError } from './pages/ServerError';
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
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600;700&display=swap"
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
  // Logged here (not shown in the UI) so real error details still reach server/browser logs
  // even though the rendered page only shows the friendly 404/500 copy.
  console.error(error);

  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <Document title="404 Not Found">
        <ChakraProvider theme={theme}>
          <StrictMode>
            <NotFound minH="100vh" />
          </StrictMode>
        </ChakraProvider>
      </Document>
    );
  }

  return (
    <Document title="Something went wrong">
      <ChakraProvider theme={theme}>
        <StrictMode>
          <ServerError minH="100vh" />
        </StrictMode>
      </ChakraProvider>
    </Document>
  );
}
