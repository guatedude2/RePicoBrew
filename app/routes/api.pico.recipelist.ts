import type { LoaderFunctionArgs } from 'react-router';
import { z } from 'zod';

const bodyValidator = z.object({
  uid: z.string(),
});

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const body = bodyValidator.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!body.success) {
    throw new Response(`Action payload error: ${JSON.stringify(body.error.flatten().fieldErrors)}`, { status: 400 });
  }

  // not sure what this api does just returns same response
  return new Response(`##\r\n`);
};
