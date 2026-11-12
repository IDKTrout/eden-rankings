// One-off import: turns the sheet CSVs in src/data/ into SQL inserts for the Supabase database.
// Usage: node scripts/sheet-to-sql.mjs <out-dir>
// Writes one .sql file per table, in the order they must be loaded.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const dataDir = new URL('../src/data/', import.meta.url);
const outDir = process.argv[2] || 'import-sql';
mkdirSync(outDir, { recursive: true });

function parse(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; } else if (c !== '\r') f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [h, ...rest] = rows;
  return rest.map((r) => Object.fromEntries(h.map((k, i) => [k, (r[i] ?? '').trim()])));
}
const read = (tab) => parse(readFileSync(new URL(`${tab}.csv`, dataDir), 'utf8'));

const num = (v) => { const s = String(v ?? '').replace(/,/g, '').trim(); return s === '' || isNaN(+s) ? null : +s; };
const bool = (v) => String(v).toUpperCase() === 'TRUE';
const lit = (v) => {
  if (v === null || v === undefined || v === '') return 'null';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'object') return lit(JSON.stringify(v)) + '::jsonb';
  return `'${String(v).replace(/'/g, "''")}'`;
};
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== ''));

function write(name, table, cols, rows) {
  const lines = rows.map((r) => `(${cols.map((c) => lit(r[c])).join(',')})`);
  const sql = `insert into public.${table} (${cols.join(',')}) values\n${lines.join(',\n')};\n`;
  writeFileSync(`${outDir}/${name}.sql`, sql);
  console.log(`${name}.sql  ${rows.length} rows  ${(sql.length / 1024).toFixed(1)} KB`);
}

// ---- reference
const regions = read('regions').filter((r) => r.region && r.first_server && r.last_server)
  .map((r) => ({ region: num(r.region), first_server: num(r.first_server), last_server: num(r.last_server), notes: r.notes }));
const groups = read('groups').filter((g) => g.group_id)
  .map((g) => ({ id: g.group_id, name: g.group_name, short_name: g.short_name, color: g.color, notes: g.notes }));

// ---- guilds and players
const guildRows = read('guilds').filter((g) => g.guild_id && g.guild_name);
const guildIds = new Set(guildRows.map((g) => g.guild_id));
const guilds = guildRows.map((g) => ({
  id: g.guild_id, name: g.guild_name, home_server: num(g.home_server),
  group_id: g.group_id || null, inactive: bool(g.inactive), notes: g.notes,
}));
const guildNames = read('guild_names').filter((n) => n.guild_name && n.guild_id)
  .map((n) => ({ name: n.guild_name, guild_id: n.guild_id, notes: n.notes }));
const playerRows = read('players').filter((p) => p.player_id && p.player_name);
const players = playerRows.map((p) => ({
  id: p.player_id, name: p.player_name, guild_id: guildIds.has(p.guild_id) ? p.guild_id : null,
  inactive: bool(p.inactive), notes: p.notes,
}));

// ---- events and seasons
const EVENTS = {
  'AbEx':          { id: 'abex',      ranks: 'guild',  score_label: 'Damage (M)', has_brackets: false, has_time: true },
  'AbEx Test':     { id: 'abex-test', ranks: 'guild',  score_label: 'Damage (M)', has_brackets: false, has_time: true },
  'Temporal Rift': { id: 'rift',      ranks: 'player', score_label: 'Floor',      has_brackets: false, has_time: false },
  'Alna':          { id: 'alna',      ranks: 'guild',  score_label: 'Points',     has_brackets: true,  has_time: false },
};
const seasonRows = read('seasons').filter((s) => s.season_id);
const events = [...new Set(seasonRows.map((s) => s.event))].map((name) => {
  if (!EVENTS[name]) throw new Error(`No event settings for "${name}"`);
  return { ...EVENTS[name], name };
});
const seasons = seasonRows.map((s, i) => ({
  id: s.season_id, event_id: EVENTS[s.event].id, season_number: num(s.season_number), title: s.title,
  end_date: s.end_date || null, sort_order: i + 1, max_score: num(s.max_damage_m),
  compiled_by: s.compiled_by, thanks: s.thanks, source_url: s.source_url, notes: s.notes,
}));

// ---- results
const results = [];
for (const r of read('abex_rankings').filter((r) => r.season_id && r.guild_name)) {
  results.push({
    season_id: r.season_id, listed_name: r.guild_name, guild_id: r.guild_id || null, player_id: null,
    bracket: null, rank: num(r.damage_rank), score: num(r.damage_m), score_rounded: false,
    time_seconds: num(r.clear_seconds), server: num(r.server),
    extra: clean({ clear_time: r.clear_time, leader_name: r.leader_name, leader_id: r.leader_id,
                   essence_rank: num(r.essence_rank), essence_m: num(r.essence_m) }),
  });
}
for (const r of read('rift_rankings').filter((r) => r.season_id && r.player_id)) {
  results.push({
    season_id: r.season_id, listed_name: r.player_name, guild_id: r.guild_id || null, player_id: r.player_id,
    bracket: null, rank: num(r.rank), score: num(r.floor), score_rounded: false,
    time_seconds: null, server: num(r.server), extra: clean({ guild_name: r.guild_name }),
  });
}
for (const r of read('alna_rankings').filter((r) => r.season_id && r.guild_name)) {
  results.push({
    season_id: r.season_id, listed_name: r.guild_name, guild_id: r.guild_id || null, player_id: null,
    bracket: num(r.bracket), rank: num(r.rank), score: num(r.points), score_rounded: bool(r.points_rounded),
    time_seconds: null, server: null, extra: {},
  });
}

// Sanity checks before anything is loaded.
const playerIds = new Set(players.map((p) => p.id));
const problems = [
  ...results.filter((r) => r.guild_id && !guildIds.has(r.guild_id)).map((r) => `result ${r.season_id} "${r.listed_name}": unknown guild ${r.guild_id}`),
  ...results.filter((r) => r.player_id && !playerIds.has(r.player_id)).map((r) => `result ${r.season_id} "${r.listed_name}": unknown player ${r.player_id}`),
  ...results.filter((r) => !r.guild_id && !r.player_id).map((r) => `result ${r.season_id} "${r.listed_name}": no guild or player`),
  ...guildNames.filter((n) => !guildIds.has(n.guild_id)).map((n) => `spelling "${n.name}": unknown guild ${n.guild_id}`),
  ...playerRows.filter((p) => p.guild_id && !guildIds.has(p.guild_id)).map((p) => `player ${p.player_id}: unknown guild ${p.guild_id} (left blank)`),
];
if (problems.length) console.log('PROBLEMS:\n' + problems.join('\n'));

write('01_regions', 'regions', ['region', 'first_server', 'last_server', 'notes'], regions);
write('02_groups', 'groups', ['id', 'name', 'short_name', 'color', 'notes'], groups);
write('03_guilds', 'guilds', ['id', 'name', 'home_server', 'group_id', 'inactive', 'notes'], guilds);
write('04_guild_names', 'guild_names', ['name', 'guild_id', 'notes'], guildNames);
write('05_players', 'players', ['id', 'name', 'guild_id', 'inactive', 'notes'], players);
write('06_events', 'events', ['id', 'name', 'ranks', 'score_label', 'has_brackets', 'has_time'], events);
write('07_seasons', 'seasons', ['id', 'event_id', 'season_number', 'title', 'end_date', 'sort_order', 'max_score', 'compiled_by', 'thanks', 'source_url', 'notes'], seasons);
write('08_results', 'results', ['season_id', 'listed_name', 'guild_id', 'player_id', 'bracket', 'rank', 'score', 'score_rounded', 'time_seconds', 'server', 'extra'], results);
