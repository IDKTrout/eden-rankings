// Supabase connection for the admin area.
// The publishable key is meant to be public: what each signed-in person may do
// is decided by the database's row-level security rules, not by this page.
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://wmrrfcobdkkllvnqvwnf.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_rBlmsD2-G_ece6fAXDL7aQ_0oa-iqX-';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

export interface Group { id: string; name: string; short_name: string; color: string; notes: string | null }
export interface EventRow { id: string; name: string; ranks: 'guild' | 'player'; score_label: string; has_brackets: boolean; has_time: boolean }
export interface Season {
  id: string; event_id: string; season_number: number | null; title: string; end_date: string | null;
  sort_order: number; max_score: number | null; compiled_by: string | null; thanks: string | null;
  source_url: string | null; notes: string | null;
}
export interface Guild { id: string; name: string; home_server: number | null; group_id: string | null; inactive: boolean; notes: string | null }
export interface Player { id: string; name: string; guild_id: string | null; inactive: boolean; notes: string | null }
export interface Result {
  id: number; season_id: string; listed_name: string; guild_id: string | null; player_id: string | null;
  bracket: number | null; rank: number | null; score: number | null; score_rounded: boolean;
  time_seconds: number | null; server: number | null; extra: Record<string, unknown>;
}
export interface Editor { user_id: string; name: string; role: 'admin' | 'helper' }

/** Throws the database's message so callers can show it. */
export function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/** Next free auto guild ID (g###). */
export async function nextGuildId(): Promise<string> {
  const rows = check(await sb.from('guilds').select('id').like('id', 'g%')) as { id: string }[];
  const max = rows.reduce((m, r) => (/^g\d+$/.test(r.id) ? Math.max(m, +r.id.slice(1)) : m), 0);
  return 'g' + String(max + 1).padStart(3, '0');
}
