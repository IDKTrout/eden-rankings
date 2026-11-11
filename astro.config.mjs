import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://edenafk.com',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
});
