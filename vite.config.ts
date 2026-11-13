import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { localExperiment } from './scripts/local-experiment.mjs'

export default defineConfig({
  plugins: [react(), localExperiment()],
  server: { fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/experiment.local.json'] } },
  base: './',
  build: {
    rollupOptions: {
      output: { manualChunks: { three: ['three'] } },
    },
  },
})
