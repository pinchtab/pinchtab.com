// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import path from 'path';

export default defineConfig({
  integrations: [react()],
  site: 'https://pinchtab.com',
  base: '/',
  output: 'static',

  // Astro 5.18+ best practices
  compressHTML: true,
  prefetch: {
    defaultStrategy: 'viewport',
  },
  security: {
    checkOrigin: true,
  },

  // Vite + Tailwind v4
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve('./src'),
      },
    },
  },

  // TypeScript strict
  typescript: {
    typeCheck: 'strict',
  },
});
