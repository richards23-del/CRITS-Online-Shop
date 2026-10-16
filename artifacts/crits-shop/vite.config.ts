import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

const rawPort = process.env.WEB_PORT ?? '25380';
const port = Number(rawPort);

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? '/';

export default defineConfig(({ mode }) => {
  const clerkEnv = loadEnv(mode, path.resolve(import.meta.dirname, '../..'), [
    'VITE_',
    'CLERK_PUBLISHABLE_KEY',
  ]);
  // Promote only Clerk's public key to Vite; the secret key stays server-side.
  const clerkPublishableKey = (
    process.env.VITE_CLERK_PUBLISHABLE_KEY ||
    clerkEnv.VITE_CLERK_PUBLISHABLE_KEY ||
    process.env.CLERK_PUBLISHABLE_KEY ||
    clerkEnv.CLERK_PUBLISHABLE_KEY ||
    ''
  ).trim();
  if (clerkPublishableKey) {
    process.env.VITE_CLERK_PUBLISHABLE_KEY = clerkPublishableKey;
  }

  return {
    base: basePath,
    plugins: [
      react(),
      tailwindcss({ optimize: false }),
    ],
    envDir: path.resolve(import.meta.dirname, '../..'),
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, 'src'),
        '@assets': path.resolve(
          import.meta.dirname,
          '..',
          '..',
          'attached_assets',
        ),
      },
      dedupe: ['react', 'react-dom'],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, 'dist/public'),
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            const modulePath = id.replaceAll('\\', '/');
            if (modulePath.includes('/node_modules/@clerk/')) return 'vendor-clerk';
            if (
              modulePath.includes('/node_modules/react/') ||
              modulePath.includes('/node_modules/react-dom/') ||
              modulePath.includes('/node_modules/scheduler/')
            ) return 'vendor-react';
            return undefined;
          },
        },
      },
    },
    server: {
      port,
      strictPort: true,
      host: process.env.WEB_HOST ?? '127.0.0.1',
      proxy: {
        // In local development, send API requests to the separate API service
        // instead of letting Vite answer them with the storefront HTML fallback.
        '/api': {
          target: process.env.API_SERVER_URL ?? 'http://127.0.0.1:8080',
          changeOrigin: false,
        },
      },
      fs: {
        strict: true,
      },
    },
    preview: {
      port,
      host: process.env.WEB_HOST ?? '127.0.0.1',
    },
  };
});
