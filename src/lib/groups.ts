// Group standings: how each group's guilds and players did in a season.
import { groups, guildById, abexFor, riftFor, alnaFor, finished, seasonById, type AbexRow, type RiftRow, type AlnaRow } from './data';

export interface AbexStanding {
  groupId: string;
  guilds: number;
  finished: number;
  best: AbexRow;
  totalDamage: number;
}

export interface RiftStanding {
  groupId: string;
  players: number;
  best: RiftRow;
}

const groupFor = (guildId: string) => guildById.get(guildId)?.groupId ?? '';

export function abexStandings(seasonId: string): AbexStanding[] {
  const rows = abexFor(seasonId).filter((r) => r.damageRank != null && r.damage != null);
  return groups
    .map((g) => {
      const mine = rows.filter((r) => groupFor(r.guildId) === g.id);
      if (!mine.length) return null;
      return {
        groupId: g.id,
        guilds: mine.length,
        finished: mine.filter(finished).length,
        best: mine[0],
        totalDamage: mine.reduce((s, r) => s + (r.damage as number), 0),
      };
    })
    .filter((x): x is AbexStanding => !!x)
    .sort((a, b) => (a.best.damageRank as number) - (b.best.damageRank as number));
}

export function riftStandings(seasonId: string): RiftStanding[] {
  const rows = riftFor(seasonId);
  return groups
    .map((g) => {
      const mine = rows.filter((r) => groupFor(r.guildId) === g.id);
      if (!mine.length) return null;
      return { groupId: g.id, players: mine.length, best: mine[0] };
    })
    .filter((x): x is RiftStanding => !!x)
    .sort((a, b) => b.players - a.players || a.best.rank - b.best.rank);
}

export const seasonOrder = (sid: string) => seasonById.get(sid)?.order ?? 0;

export interface AlnaStanding {
  groupId: string;
  guilds: number;
  bracketWins: number;
  podiums: number;
  best: AlnaRow;
}

/** How each group's guilds did in an Alna season (only the guilds the site shows). */
export function alnaStandings(seasonId: string): AlnaStanding[] {
  const rows = alnaFor(seasonId);
  return groups
    .map((g) => {
      const mine = rows.filter((r) => groupFor(r.guildId) === g.id);
      if (!mine.length) return null;
      return {
        groupId: g.id,
        guilds: mine.length,
        bracketWins: mine.filter((r) => r.bracketRank === 1).length,
        podiums: mine.filter((r) => r.bracketRank <= 3).length,
        best: mine[0],
      };
    })
    .filter((x): x is AlnaStanding => !!x)
    .sort((a, b) => (a.best.overallRank as number) - (b.best.overallRank as number) || b.guilds - a.guilds);
}
