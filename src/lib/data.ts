// Reads the CSV copies of the sheet (src/data/*.csv) and turns them into typed records
// plus the lookups every page needs. Everything here runs at build time only.

import seasonsCsv from '../data/seasons.csv?raw';
import abexCsv from '../data/abex_rankings.csv?raw';
import riftCsv from '../data/rift_rankings.csv?raw';
import guildsCsv from '../data/guilds.csv?raw';
import guildNamesCsv from '../data/guild_names.csv?raw';
import groupsCsv from '../data/groups.csv?raw';
import regionsCsv from '../data/regions.csv?raw';
import playersCsv from '../data/players.csv?raw';

export type Kind = 'abex' | 'rift';

export interface Season {
  id: string;
  event: string;
  number: number | null;
  title: string;
  kind: Kind;
  compiledBy: string;
  /** Extra thanks, shown word for word under the credit. */
  thanks: string;
  sourceUrl: string;
  notes: string;
  /** Day the event ended (YYYY-MM-DD), or '' if not filled in. */
  endDate: string;
  /** AbEx only: the most damage a guild can deal (millions). Guilds at this number finished. */
  maxDamage: number | null;
  /** Position in the seasons tab; the tab lists events oldest first. */
  order: number;
}

export interface AbexRow {
  seasonId: string;
  damageRank: number | null;
  guildName: string;
  leaderName: string;
  leaderId: string;
  server: number | null;
  damage: number | null; // millions
  time: string;
  seconds: number | null;
  essenceRank: number | null;
  essence: number | null; // millions
  guildId: string;
}

export interface RiftRow {
  seasonId: string;
  rank: number;
  playerName: string;
  playerId: string;
  floor: number;
  server: number | null;
  guildName: string;
  guildId: string;
}

export interface Group {
  id: string;
  name: string;
  short: string;
  /** Hex color from the groups tab (#RRGGBB), or '' to use an automatic color. */
  color: string;
  notes: string;
}

export interface Guild {
  id: string;
  name: string;
  groupId: string;
  /** Ticked as inactive in the guilds tab. */
  inactive: boolean;
  homeServer: number | null;
  names: string[];
  notes: string;
}

export interface Player {
  id: string;
  name: string; // most recent name
  names: string[];
  guildId: string; // most recent guild
  rift: RiftRow[];
  led: AbexRow[];
  /** Ticked as inactive in the players tab. */
  inactive: boolean;
}

/* ------------------------------------------------------------------ CSV */

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  const [head = [], ...body] = rows;
  const keys = head.map((h) => h.trim());
  return body
    .filter((r) => r.some((c) => c.trim() !== ''))
    .map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

const num = (v: string | undefined): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};
const str = (v: string | undefined) => (v ?? '').trim();
/** Reads a date cell (normally YYYY-MM-DD) and returns YYYY-MM-DD, or '' if blank or unreadable. */
function toIsoDate(v: string | undefined) {
  const s = str(v);
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ records */

export const seasons: Season[] = parseCsv(seasonsCsv)
  .filter((r) => r.season_id)
  .map((r, i) => ({
    id: r.season_id,
    event: str(r.event),
    number: num(r.season_number),
    title: str(r.title),
    kind: (r.data_tab === 'rift_rankings' ? 'rift' : 'abex') as Kind,
    compiledBy: str(r.compiled_by),
    thanks: str(r.thanks),
    sourceUrl: str(r.source_url),
    notes: str(r.notes),
    endDate: toIsoDate(r.end_date),
    maxDamage: num(r.max_damage_m),
    order: i,
  }));

export const abex: AbexRow[] = parseCsv(abexCsv)
  .filter((r) => r.season_id && r.guild_name)
  .map((r) => ({
    seasonId: r.season_id,
    damageRank: num(r.damage_rank),
    guildName: str(r.guild_name),
    leaderName: str(r.leader_name),
    leaderId: str(r.leader_id).replace(/,/g, ''),
    server: num(r.server),
    damage: num(r.damage_m),
    time: str(r.clear_time),
    seconds: num(r.clear_seconds),
    essenceRank: num(r.essence_rank),
    essence: num(r.essence_m),
    guildId: str(r.guild_id),
  }));

export const rift: RiftRow[] = parseCsv(riftCsv)
  .filter((r) => r.season_id && r.player_id)
  .map((r) => ({
    seasonId: r.season_id,
    rank: num(r.rank) ?? 0,
    playerName: str(r.player_name),
    playerId: str(r.player_id).replace(/,/g, ''),
    floor: num(r.floor) ?? 0,
    server: num(r.server),
    guildName: str(r.guild_name),
    guildId: str(r.guild_id),
  }));

const guildNameRows = parseCsv(guildNamesCsv).filter((r) => r.guild_name && r.guild_id);

export const guilds: Guild[] = parseCsv(guildsCsv)
  .filter((r) => r.guild_id)
  .map((r) => ({
    id: str(r.guild_id),
    name: str(r.guild_name),
    groupId: str(r.group_id),
    inactive: /^true$/i.test(str(r.inactive)),
    homeServer: num(r.home_server),
    names: guildNameRows.filter((n) => n.guild_id === r.guild_id).map((n) => n.guild_name),
    notes: str(r.notes),
  }));

export const groups: Group[] = parseCsv(groupsCsv)
  .filter((r) => r.group_id)
  .map((r) => ({ id: str(r.group_id), name: str(r.group_name) || str(r.group_id), short: str(r.short_name) || str(r.group_name), color: /^#[0-9a-f]{6}$/i.test(str(r.color)) ? str(r.color) : '', notes: str(r.notes) }));

/** Regions group servers together: every server from first to last belongs to the region. */
const regionRows = parseCsv(regionsCsv).filter((r) => r.region);
/** How many regions the regions tab lists, including ones whose servers aren't filled in yet. */
export const regionsListed = regionRows.length;
export const regions = regionRows
  .map((r) => ({ region: num(r.region), first: num(r.first_server), last: num(r.last_server) }))
  .filter((r): r is { region: number; first: number; last: number } => r.region != null && r.first != null && r.last != null)
  .sort((a, b) => a.region - b.region);

/** The region a server belongs to, or null if no region in the regions tab covers it. */
export const regionOf = (server: number | null | undefined) =>
  server == null ? null : regions.find((r) => server >= r.first && server <= r.last)?.region ?? null;

/* ------------------------------------------------------------------ lookups */

export const seasonById = new Map(seasons.map((s) => [s.id, s]));

/** Everyone credited with gathering a season, for the site footer. */
export const compilers = [...new Set(seasons.map((s) => s.compiledBy).filter(Boolean))];
export const guildById = new Map(guilds.map((g) => [g.id, g]));
export const groupById = new Map(groups.map((g) => [g.id, g]));
/** The group a guild belongs to now, if any. */
export const groupOf = (guildId: string) => groupById.get(guildById.get(guildId)?.groupId ?? '');
/** A group's color: its hex code from the sheet, or an automatic one by its position in the groups tab. */
export function groupColor(groupId: string) {
  const g = groupById.get(groupId);
  if (g?.color) return g.color;
  const hues = [150, 2, 215, 275, 190, 35, 320, 95];
  const i = Math.max(0, groups.findIndex((x) => x.id === groupId));
  return `hsl(${hues[i % hues.length]} 55% 45%)`;
}
export const groupMembers = (groupId: string) => guilds.filter((g) => g.groupId === groupId);

export const seasonLabel = (s: Season) => `${s.event}${s.number != null ? ` S${s.number}` : ''}`;
export const seasonsOf = (kind: Kind) => seasons.filter((s) => s.kind === kind);
/** Newest season of a kind: the seasons tab lists events in the order they took place. */
export const latestOf = (kind: Kind) => seasonsOf(kind).at(-1);

/** The damage that counts as finishing an AbEx season: its max damage, or the top damage dealt if the max isn't recorded. */
export function finishLine(seasonId: string) {
  const s = seasonById.get(seasonId);
  if (s?.maxDamage != null) return s.maxDamage;
  const dealt = abex.filter((r) => r.seasonId === seasonId && r.damage != null).map((r) => r.damage as number);
  return dealt.length ? Math.max(...dealt) : null;
}

/** True when an AbEx row reached its season's max damage. Its time is then a finish time; otherwise it is the time of the last attack. */
export function finished(r: AbexRow) {
  const line = finishLine(r.seasonId);
  return line != null && r.damage != null && r.damage >= line;
}

/** "Finished 143:02:53" or "Last attack 263:57:49". */
export const timeNote = (r: AbexRow) => (r.time ? `${finished(r) ? 'Finished' : 'Last attack'} ${r.time}` : '');

export const guildLabel = (id: string, fallback = '') => guildById.get(id)?.name || fallback || id;
/** A ranking row's guild under its current name (from the guilds tab), falling back to the name listed that season. */
export const nameOf = (r: { guildId: string; guildName: string }) => guildLabel(r.guildId, r.guildName);

export function abexFor(seasonId: string) {
  return abex
    .filter((r) => r.seasonId === seasonId)
    .sort((a, b) => (a.damageRank ?? 1e9) - (b.damageRank ?? 1e9) || (a.essenceRank ?? 1e9) - (b.essenceRank ?? 1e9));
}

export function riftFor(seasonId: string) {
  return rift.filter((r) => r.seasonId === seasonId).sort((a, b) => a.rank - b.rank);
}

/** Player IDs ticked as inactive in the players tab. */
const inactivePlayers = new Set(
  parseCsv(playersCsv).filter((r) => /^true$/i.test(str(r.inactive))).map((r) => str(r.player_id).replace(/,/g, '')),
);

/** Players, built from every ranking row that carries a player ID. Later seasons win for name and guild. */
export const players: Player[] = (() => {
  const map = new Map<string, Player>();
  const get = (id: string) => {
    let p = map.get(id);
    if (!p) { p = { id, name: '', names: [], guildId: '', rift: [], led: [], inactive: inactivePlayers.has(id) }; map.set(id, p); }
    return p;
  };
  const order = (sid: string) => seasonById.get(sid)?.order ?? 0;
  const touched = new Map<string, number>();
  const note = (p: Player, name: string, guildId: string, sid: string) => {
    if (name && !p.names.includes(name)) p.names.push(name);
    if (order(sid) >= (touched.get(p.id) ?? -1)) {
      touched.set(p.id, order(sid));
      if (name) p.name = name;
      if (guildId) p.guildId = guildId;
    }
  };
  for (const r of abex) {
    if (!r.leaderId) continue;
    const p = get(r.leaderId);
    p.led.push(r);
    note(p, r.leaderName, r.guildId, r.seasonId);
  }
  for (const r of rift) {
    const p = get(r.playerId);
    p.rift.push(r);
    note(p, r.playerName, r.guildId, r.seasonId);
  }
  for (const p of map.values()) {
    p.rift.sort((a, b) => order(a.seasonId) - order(b.seasonId));
    p.led.sort((a, b) => order(a.seasonId) - order(b.seasonId));
    if (!p.name) p.name = p.id;
  }
  return [...map.values()];
})();

export const playerById = new Map(players.map((p) => [p.id, p]));

/** Guild IDs that appear in any ranking, so every one gets a page even if the guilds tab lags behind. */
export const guildIds = [...new Set([...guilds.map((g) => g.id), ...abex.map((r) => r.guildId), ...rift.map((r) => r.guildId)].filter(Boolean))];

/* ------------------------------------------------------------------ summaries */

export function abexSummary(seasonId: string) {
  const rows = abexFor(seasonId).filter((r) => r.damageRank != null && r.damage != null);
  if (!rows.length) return null;
  const damages = rows.map((r) => r.damage as number).sort((a, b) => a - b);
  const mid = Math.floor(damages.length / 2);
  const median = damages.length % 2 ? damages[mid] : (damages[mid - 1] + damages[mid]) / 2;
  const top = damages[damages.length - 1];
  const max = finishLine(seasonId) ?? top;
  const done = rows.filter((r) => (r.damage as number) >= max);
  const fastest = [...done].sort((a, b) => (a.seconds ?? Infinity) - (b.seconds ?? Infinity))[0] ?? null;
  const notDone = rows.filter((r) => (r.damage as number) < max);
  return {
    guilds: rows.length,
    leader: rows[0],
    second: rows[1] ?? null,
    /** Highest damage any guild dealt. */
    top,
    /** The season's max damage (the finish line). */
    max,
    maxRecorded: seasonById.get(seasonId)?.maxDamage != null,
    median,
    finished: done.length,
    fastest,
    /** Best guild that did not finish, if any guilds finished. */
    nextBest: done.length ? notDone[0] ?? null : null,
    hasEssence: abexFor(seasonId).some((r) => r.essence != null),
  };
}

export function riftSummary(seasonId: string) {
  const rows = riftFor(seasonId);
  if (!rows.length) return null;
  const byGuild = new Map<string, { guildId: string; name: string; players: number; best: number }>();
  for (const r of rows) {
    const key = r.guildId || r.guildName;
    if (!key) continue;
    const g = byGuild.get(key) ?? { guildId: r.guildId, name: guildLabel(r.guildId, r.guildName), players: 0, best: 0 };
    g.players++; g.best = Math.max(g.best, r.floor);
    byGuild.set(key, g);
  }
  const guildList = [...byGuild.values()].sort((a, b) => b.players - a.players || b.best - a.best);
  return {
    players: rows.length,
    top: rows[0],
    cutoff: rows[rows.length - 1].floor,
    guilds: guildList,
  };
}

/* ------------------------------------------------------------------ formatting */

const intFmt = new Intl.NumberFormat('en-US');
const decFmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtInt = (v: number | null | undefined) => (v == null ? '—' : intFmt.format(v));
export const fmtM = (v: number | null | undefined) => (v == null ? '—' : `${intFmt.format(v)}M`);
export const fmtEss = (v: number | null | undefined) => (v == null ? '—' : `${decFmt.format(v)}M`);
/** "S204 · R20" when the server's region is known, otherwise "S204". */
/** "Nov 10, 2026" from YYYY-MM-DD (read as a calendar day, not shifted by time zone). */
export const fmtDate = (iso: string) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(y, m - 1, d));
};
export const fmtServer = (v: number | null | undefined) => {
  if (v == null) return '—';
  const region = regionOf(v);
  return region == null ? `S${v}` : `S${v} · R${region}`;
};
