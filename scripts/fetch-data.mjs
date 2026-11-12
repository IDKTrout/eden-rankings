// Downloads the rankings from the Supabase database into src/data/*.csv, in the same
// shape the site has always read (one file per former sheet tab), so the pages don't change.
// Uses the public, read-only key: the database only lets it read.
//
// If the download fails, the files already in src/data/ are kept so the build still works.

import { writeFile, mkdir } from 'node:fs/promises';

const URL_BASE = process.env.SUPABASE_URL || 'https://wmrrfcobdkkllvnqvwnf.supabase.co';
const KEY = process.env.SUPABASE_KEY || 'sb_publishable_rBlmsD2-G_ece6fAXDL7aQ_0oa-iqX-';
const dataDir = new URL('../src/data/', import.meta.url);

/** Reads a whole table (paging through PostgREST's row limit). */
async function table(name, order) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${URL_BASE}/rest/v1/${name}?select=*&order=${order}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${from}-${from + 999}`, 'Range-Unit': 'items' },
    });
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status} ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

const cell = (v) => {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
async function writeCsv(name, cols, rows) {
  const text = [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n') + '\n';
  await writeFile(new URL(`${name}.csv`, dataDir), text);
  console.log(`[db] ${name}: ${rows.length} rows`);
}
const hms = (sec) => (sec == null ? '' : `${Math.floor(sec / 3600)}:${String(Math.floor(sec / 60) % 60).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`);

try {
  const [events, seasons, results, guilds, guildNames, players, groups, regions] = await Promise.all([
    table('events', 'id'),
    table('seasons', 'sort_order'),
    table('results', 'id'),
    table('guilds', 'id'),
    table('guild_names', 'seen_order'),
    table('players', 'id'),
    table('groups', 'sort_order'),
    table('regions', 'region'),
  ]);
  await mkdir(dataDir, { recursive: true });

  // Which of the site's three layouts each event uses.
  const eventById = new Map(events.map((e) => [e.id, e]));
  const tabOf = (s) => {
    const e = eventById.get(s.event_id);
    return e?.ranks === 'player' ? 'rift_rankings' : e?.has_brackets ? 'alna_rankings' : 'abex_rankings';
  };
  const seasonTab = new Map(seasons.map((s) => [s.id, tabOf(s)]));
  const seasonOrder = new Map(seasons.map((s) => [s.id, s.sort_order]));
  const bySeason = (a, b) => seasonOrder.get(a.season_id) - seasonOrder.get(b.season_id) || a.id - b.id;
  const of = (tab) => results.filter((r) => seasonTab.get(r.season_id) === tab).sort(bySeason);

  await writeCsv('seasons', ['season_id', 'event', 'season_number', 'end_date', 'title', 'data_tab', 'compiled_by', 'source_url', 'notes', 'max_damage_m', 'thanks'],
    seasons.map((s) => ({
      season_id: s.id, event: eventById.get(s.event_id)?.name ?? s.event_id, season_number: s.season_number, end_date: s.end_date,
      title: s.title, data_tab: tabOf(s), compiled_by: s.compiled_by, source_url: s.source_url, notes: s.notes,
      max_damage_m: s.max_score, thanks: s.thanks,
    })));

  await writeCsv('abex_rankings', ['season_id', 'damage_rank', 'guild_name', 'leader_name', 'leader_id', 'server', 'damage_m', 'clear_time', 'clear_seconds', 'essence_rank', 'essence_m', 'guild_id'],
    of('abex_rankings').map((r) => ({
      season_id: r.season_id, damage_rank: r.rank, guild_name: r.listed_name, leader_name: r.extra?.leader_name, leader_id: r.extra?.leader_id,
      server: r.server, damage_m: r.score, clear_time: r.extra?.clear_time || hms(r.time_seconds), clear_seconds: r.time_seconds,
      essence_rank: r.extra?.essence_rank, essence_m: r.extra?.essence_m, guild_id: r.guild_id,
    })));

  await writeCsv('rift_rankings', ['season_id', 'rank', 'player_name', 'player_id', 'floor', 'server', 'guild_name', 'guild_id'],
    of('rift_rankings').map((r) => ({
      season_id: r.season_id, rank: r.rank, player_name: r.listed_name, player_id: r.player_id, floor: r.score,
      server: r.server, guild_name: r.extra?.guild_name ?? '', guild_id: r.guild_id,
    })));

  // Overall Alna rank: by points across brackets; equal points in the same bracket keep the bracket's order.
  const alna = of('alna_rankings');
  const overall = (r) => 1 + alna.filter((o) => o.season_id === r.season_id && o.score != null && r.score != null &&
    (o.score > r.score || (o.score === r.score && o.bracket === r.bracket && o.rank < r.rank))).length;
  await writeCsv('alna_rankings', ['season_id', 'bracket', 'rank', 'guild_name', 'points', 'points_rounded', 'guild_id', 'overall_rank'],
    alna.map((r) => ({
      season_id: r.season_id, bracket: r.bracket, rank: r.rank, guild_name: r.listed_name, points: r.score,
      points_rounded: r.score_rounded, guild_id: r.guild_id, overall_rank: r.score == null ? '' : overall(r),
    })));

  await writeCsv('guilds', ['guild_id', 'guild_name', 'home_server', 'notes', 'group_id', 'inactive'],
    guilds.map((g) => ({ guild_id: g.id, guild_name: g.name, home_server: g.home_server, notes: g.notes, group_id: g.group_id, inactive: g.inactive })));
  await writeCsv('guild_names', ['guild_name', 'guild_id', 'notes'],
    guildNames.map((n) => ({ guild_name: n.name, guild_id: n.guild_id, notes: n.notes })));
  await writeCsv('players', ['player_id', 'player_name', 'guild_id', 'notes', 'inactive'],
    players.map((p) => ({ player_id: p.id, player_name: p.name, guild_id: p.guild_id, notes: p.notes, inactive: p.inactive })));
  await writeCsv('groups', ['group_id', 'group_name', 'short_name', 'color', 'notes'],
    groups.map((g) => ({ group_id: g.id, group_name: g.name, short_name: g.short_name, color: g.color, notes: g.notes })));
  await writeCsv('regions', ['region', 'first_server', 'last_server', 'notes'],
    regions.map((r) => ({ region: r.region, first_server: r.first_server, last_server: r.last_server, notes: r.notes })));
} catch (err) {
  console.warn(`[db] Could not download the database (${err.message}); keeping the saved copies in src/data/.`);
  process.exitCode = 0;
}
