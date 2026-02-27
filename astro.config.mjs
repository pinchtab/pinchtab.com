// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';

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
        '@': new URL('./src', import.meta.url).pathname,
      },
    },
  },
});
