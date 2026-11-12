// Region standings: which guilds and players belong to each region, and how they placed.
import {
  regions, regionOf, abex, abexFor, riftFor, guilds, players, finished, seasonById,
  type AbexRow, type RiftRow, type Player,
} from './data';

const order = (sid: string) => seasonById.get(sid)?.order ?? 0;

/** A guild's server: its home server from the guilds tab, else the server on its newest AbEx row. */
export function guildServer(guildId: string): number | null {
  const g = guilds.find((x) => x.id === guildId);
  if (g?.homeServer != null) return g.homeServer;
  const rows = abex.filter((r) => r.guildId === guildId && r.server != null).sort((a, b) => order(b.seasonId) - order(a.seasonId));
  return rows[0]?.server ?? null;
}

/** A player's server from their newest ranking row. */
export function playerServer(p: Player): number | null {
  const rows = [...p.rift, ...p.led].filter((r) => r.server != null).sort((a, b) => order(b.seasonId) - order(a.seasonId));
  return rows[0]?.server ?? null;
}

export const guildsInRegion = (region: number) => guilds.filter((g) => regionOf(guildServer(g.id)) === region);
export const playersInRegion = (region: number) => players.filter((p) => regionOf(playerServer(p)) === region);

export interface RegionAbex { guilds: number; finished: number; best: AbexRow }
export interface RegionRift { players: number; best: RiftRow }

/** How a region's guilds did in an AbEx season (by the server on that season's row). */
export function regionAbex(region: number, seasonId: string): RegionAbex | null {
  const rows = abexFor(seasonId).filter((r) => r.damageRank != null && r.damage != null && regionOf(r.server) === region);
  return rows.length ? { guilds: rows.length, finished: rows.filter(finished).length, best: rows[0] } : null;
}

/** How a region's players did in a Temporal Rift season. */
export function regionRift(region: number, seasonId: string): RegionRift | null {
  const rows = riftFor(seasonId).filter((r) => regionOf(r.server) === region);
  return rows.length ? { players: rows.length, best: rows[0] } : null;
}

export interface RegionAbexStanding extends RegionAbex { region: number; totalDamage: number }
export interface RegionRiftStanding extends RegionRift { region: number }

/** Every region with a guild in an AbEx season, ordered by its best guild (like the Groups standings). */
export function abexRegionStandings(seasonId: string): RegionAbexStanding[] {
  const rows = abexFor(seasonId).filter((r) => r.damageRank != null && r.damage != null);
  const by = new Map<number, AbexRow[]>();
  for (const r of rows) {
    const region = regionOf(r.server);
    if (region != null) by.set(region, [...(by.get(region) ?? []), r]);
  }
  return [...by].map(([region, mine]) => ({
    region, guilds: mine.length, finished: mine.filter(finished).length, best: mine[0],
    totalDamage: mine.reduce((s, r) => s + (r.damage as number), 0),
  })).sort((a, b) => (a.best.damageRank as number) - (b.best.damageRank as number));
}

/** Every region with a player in a Temporal Rift season: most players first, then best rank. */
export function riftRegionStandings(seasonId: string): RegionRiftStanding[] {
  const by = new Map<number, RiftRow[]>();
  for (const r of riftFor(seasonId)) {
    const region = regionOf(r.server);
    if (region != null) by.set(region, [...(by.get(region) ?? []), r]);
  }
  return [...by].map(([region, mine]) => ({ region, players: mine.length, best: mine[0] }))
    .sort((a, b) => b.players - a.players || a.best.rank - b.best.rank);
}

export const regionNumbers = regions.map((r) => r.region);
export const regionRange = (region: number) => regions.find((r) => r.region === region);
