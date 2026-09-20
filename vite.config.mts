import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  ssr: {
    // react-icons@4.12.0's ESM entry points do directory imports (e.g. `react-icons/gi` resolving
    // to a bare `lib/` directory) that Node's own strict ESM resolver rejects at runtime
    // (`ERR_UNSUPPORTED_DIR_IMPORT`) once the project is "type": "module" — confirmed by actually
    // running the built server bundle, not just building it. Left as an external SSR import (the
    // Vite default for node_modules deps), that broken resolution happens live in production;
    // bundling it here instead resolves it at build time, since every page that uses any icon gets
    // server-rendered too.
    noExternal: ['react-icons'],
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, 'app'),
    },
    // Radix packages (used by the new shadcn/ui components) each carry their own resolved `react`
    // symlink under pnpm's strict node_modules layout; without deduping, Vite can treat those as a
    // second React module instance, breaking hooks with a null-context "Invalid hook call" error.
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    // Pre-bundle these up front in the same pass as React itself, instead of letting Vite
    // discover them lazily on first render — a lazy, incremental optimize pass mid-session is
    // what was producing a second, disconnected React module instance in the browser.
    include: [
      '@radix-ui/react-tabs',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-label',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-slot',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-switch',
      '@radix-ui/react-progress',
      '@radix-ui/react-select',
      'class-variance-authority',
      'clsx',
      'tailwind-merge',
    ],
  },
});
