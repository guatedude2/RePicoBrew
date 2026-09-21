import type { Config } from '@react-router/dev/config';

export default {
  ssr: true,
  future: {
    // Lets the admin layout run a login check before every loader/action beneath it — including the
    // `.data` and form-action requests that skip a parent's loader.
    v8_middleware: true,
  },
} satisfies Config;
