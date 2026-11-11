import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://event-rankings.edenafk.com',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
});
