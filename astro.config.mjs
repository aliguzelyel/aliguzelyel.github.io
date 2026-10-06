// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://aliguzelyel.github.io',
  integrations: [sitemap()],
  vite: {
    // @ts-ignore -- vite 6 (astro) vs vite 8 (@tailwindcss/vite) plugin type mismatch; runtime is compatible
    plugins: [tailwindcss()],
  },
});
