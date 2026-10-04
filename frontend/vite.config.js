import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// The team-specific Firebase web config is intentionally gitignored. Copy it
// beside the production bundle when it exists; Firebase Hosting supplies
// /__/firebase/init.json as the runtime fallback when it does not.
function copyFirebaseConfig() {
  return {
    name: 'copy-firebase-config',
    closeBundle() {
      const source = resolve('js/firebaseConfig.json');
      if (!existsSync(source)) return;
      const destination = resolve('dist/assets/firebaseConfig.json');
      mkdirSync(resolve('dist/assets'), { recursive: true });
      copyFileSync(source, destination);
    },
  };
}

export default defineConfig({
  plugins: [react(), copyFirebaseConfig()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8080',
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  },
});
