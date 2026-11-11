// Lists every page for search engines, built from the same data as the pages themselves.
import type { APIRoute } from 'astro';
import { seasons, guildIds, players, groups, regions } from '../lib/data';

export const GET: APIRoute = ({ site }) => {
  const base = (site?.toString() ?? 'https://event-rankings.edenafk.com/').replace(/\/$/, '');
  const paths = [
    '/', '/seasons/', '/guilds/', '/groups/', '/regions/', '/players/', '/search/',
    ...seasons.map((s) => `/season/${s.id}/`),
    ...guildIds.map((id) => `/guild/${encodeURIComponent(id)}/`),
    ...players.map((p) => `/player/${p.id}/`),
    ...groups.map((g) => `/group/${encodeURIComponent(g.id)}/`),
    ...regions.map((r) => `/region/${r.region}/`),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths
    .map((p) => `  <url><loc>${base}${p}</loc></url>`)
    .join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
