import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { spawn } from 'child_process';
import { createConnection } from 'net';
import { defineConfig } from 'vite';

/** Check if port 3000 is already bound — if so, skip spawning */
function isPort3000InUse(): Promise<boolean> {
  return new Promise((resolve) => {
    const client = createConnection({ port: 3000, host: '127.0.0.1' });
    client.on('connect', () => { client.destroy(); resolve(true); });
    client.on('error', () => { client.destroy(); resolve(false); });
  });
}

/** Plugin that starts the Express API server (port 3000) alongside Vite */
function expressServerPlugin() {
  let serverProcess: ReturnType<typeof spawn> | null = null;
  let started = false; // guard: only ever start once per Vite process lifetime

  async function startServer() {
    if (started) return;
    started = true;

    // If another instance already holds port 3000, don't spawn at all
    const inUse = await isPort3000InUse();
    if (inUse) {
      console.log('[express-server] Port 3000 already occupied — skipping spawn, using existing server.');
      return;
    }

    serverProcess = spawn('npx', ['tsx', 'server.ts'], {
      env: { ...process.env, PORT: '3000', NODE_ENV: 'development' },
      cwd: process.cwd(),
      stdio: 'inherit',
      detached: false,
    });

    serverProcess.on('error', (err: any) => {
      console.error('[express-server] spawn error:', err.message);
      serverProcess = null;
      started = false;
    });

    serverProcess.on('exit', (code: number | null, signal: string | null) => {
      serverProcess = null;
      started = false;
      // Only auto-restart on crash (non-zero exit) — NOT on clean exit(0) which = EADDRINUSE
      const isCrash = code !== null && code !== 0;
      const isUnexpectedSignal = signal !== null && signal !== 'SIGTERM' && signal !== 'SIGINT';
      if (isCrash || isUnexpectedSignal) {
        console.warn(`[express-server] Crashed (code=${code}, signal=${signal}). Restarting in 2s...`);
        setTimeout(startServer, 2000);
      } else {
        console.log(`[express-server] Stopped (code=${code}, signal=${signal}). No restart needed.`);
      }
    });
  }

  return {
    name: 'start-express-server',
    configureServer() {
      startServer();
      process.on('exit', () => { serverProcess?.kill('SIGTERM'); });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), expressServerPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        // Exclude backend files — changes here must NOT restart Vite (Express handles its own reload)
        ignored: ['**/server.ts', '**/.env', '**/.env.*', '**/node_modules/**'],
      },
      // Proxy all backend routes to the Express server on port 3000
      proxy: {
        '/api': { target: 'http://localhost:3000', changeOrigin: true },
        '/auth': { target: 'http://localhost:3000', changeOrigin: true },
        '/deploy': { target: 'http://localhost:3000', changeOrigin: true },
      },
    },
  };
});
