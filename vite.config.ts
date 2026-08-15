import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Pin the dev server to Rayfin's per-project port (VITE_PORT, mapped from
  // RAYFIN_PUBLIC_FRONTEND_PORT in .env.local) so multiple local frontends
  // don't collide and the deployed backend can allow-list one stable origin.
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const port = env.VITE_PORT ? Number(env.VITE_PORT) : undefined;

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': resolve(import.meta.dirname, 'src'),
      },
    },
    ...(port ? { server: { port, strictPort: true } } : {}),
    build: {
      target: 'es2022',
      rollupOptions: {
        input: {
          // The MSAL v5 redirect URI must resolve to its own page that runs the
          // redirect bridge; booting the SPA there would swallow the response.
          main: resolve(import.meta.dirname, 'index.html'),
          'auth-redirect': resolve(
            import.meta.dirname,
            'auth-redirect.html'
          ),
        },
      },
    },
    esbuild: {
      target: 'es2022',
    },
    optimizeDeps: {
      esbuildOptions: {
        target: 'es2022',
      },
    },
  };
});
