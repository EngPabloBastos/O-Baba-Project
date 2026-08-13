import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Config bem simples, sem TypeScript e sem Tailwind — só React + CSS puro.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
