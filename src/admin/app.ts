// Event Rankings admin: sign in, then add and fix seasons, results, guilds and players.
// Permissions are enforced by the database; this page only hides what you can't use.
import { sb, check, nextGuildId, type Group, type EventRow, type Season, type Guild, type Player, type Result, type Editor } from './db';
import {
  h, clear, field, text, num, check as box, area, select, status, busy,
  parseNum, parseInt0, parseTime, isRounded, fmtTime, fmtInt, blank,
} from './ui';

const root = document.getElementById('admin') as HTMLElement;

let me: { id: string; email: string } | null = null;
let editor: Editor | null = null;
let groups: Group[] = [];
let events: EventRow[] = [];
let seasons: Season[] = [];
let guilds: Guild[] = [];
let spellings: { name: string; guild_id: string; notes: string | null }[] = [];
let players: Player[] = [];
let guildById = new Map<string, Guild>();
let guildBySpelling = new Map<string, string>();
let playerById = new Map<string, Player>();

const isAdmin = () => editor?.role === 'admin';
const eventOf = (s: Season) => events.find((e) => e.id === s.event_id)!;
const seasonLabel = (s: Season) => `${eventOf(s)?.name ?? s.event_id} S${s.season_number ?? '?'} · ${s.id}`;
const guildLabel = (id: string | null) => (id ? `${guildById.get(id)?.name ?? '(unknown guild)'} · ${id}` : '');
const remember = (k: string, v?: string) => {
  try { if (v === undefined) return localStorage.getItem('admin.' + k); localStorage.setItem('admin.' + k, v); } catch { /* storage off */ }
  return null;
};

// ------------------------------------------------------------------ data

async function loadAll() {
  const [g, e, s, gu, sp, pl] = await Promise.all([
    sb.from('groups').select('*').order('name'),
    sb.from('events').select('*').order('name'),
    sb.from('seasons').select('*').order('sort_order'),
    sb.from('guilds').select('id,name,home_server,group_id,inactive,notes').order('name'),
    sb.from('guild_names').select('*').order('name'),
    sb.from('players').select('id,name,guild_id,inactive,notes').order('name'),
  ]);
  groups = check(g) as Group[];
  events = check(e) as EventRow[];
  seasons = check(s) as Season[];
  guilds = check(gu) as Guild[];
  spellings = check(sp) as typeof spellings;
  players = check(pl) as Player[];
  guildById = new Map(guilds.map((x) => [x.id, x]));
  guildBySpelling = new Map(spellings.map((x) => [x.name, x.guild_id]));
  for (const x of guilds) if (!guildBySpelling.has(x.name)) guildBySpelling.set(x.name, x.id);
  playerById = new Map(players.map((x) => [x.id, x]));
}

// ------------------------------------------------------------------ start

async function start() {
  const { data } = await sb.auth.getSession();
  await onSession(data.session?.user ?? null);
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') onSession(null);
  });
}

async function onSession(user: { id: string; email?: string } | null) {
  me = user ? { id: user.id, email: user.email ?? '' } : null;
  editor = null;
  if (!me) return renderSignIn();
  clear(root, h('p', { class: 'muted' }, 'Loading…'));
  try {
    editor = check(await sb.from('editors').select('user_id,name,role').eq('user_id', me.id).maybeSingle()) as Editor | null;
    if (!editor) return renderNotEditor();
    await loadAll();
    renderApp();
  } catch (e) {
    clear(root, h('p', { class: 'status err' }, e instanceof Error ? e.message : String(e)), signOutButton());
  }
}

function signOutButton() {
  return h('button', { type: 'button', class: 'btn ghost', onclick: () => sb.auth.signOut() }, 'Sign out');
}

function renderSignIn() {
  const email = h('input', { type: 'email', autocomplete: 'username', required: true });
  const pass = h('input', { type: 'password', autocomplete: 'current-password', required: true });
  const st = status();
  const btn = h('button', { type: 'submit', class: 'btn' }, 'Sign in');
  const form = h('form', { class: 'card signin' },
    h('h2', {}, 'Sign in'),
    h('p', { class: 'muted small' }, 'For Event Rankings editors. Ask the site admin for an account.'),
    field('Email', email),
    field('Password', pass),
    btn, st,
  );
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    btn.disabled = true;
    st.info('Signing in…');
    const { data, error } = await sb.auth.signInWithPassword({ email: email.value.trim(), password: pass.value });
    btn.disabled = false;
    if (error) return st.err(error);
    await onSession(data.user);
  });
  clear(root, form);
  email.focus();
}

function renderNotEditor() {
  const idBox = h('code', { class: 'uid' }, me!.id);
  clear(root, h('section', { class: 'card' },
    h('h2', {}, 'You are signed in, but not an editor yet'),
    h('p', {}, 'Send this user ID to the site admin so they can add you:'),
    idBox,
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn', onclick: () => navigator.clipboard?.writeText(me!.id) }, 'Copy ID'),
      signOutButton()),
  ));
}

// ------------------------------------------------------------------ shell

type Tab = { id: string; label: string; render: (panel: HTMLElement) => void | Promise<void>; adminOnly?: boolean };
const TABS: Tab[] = [
  { id: 'results', label: 'Results', render: resultsTab },
  { id: 'guilds', label: 'Guilds', render: guildsTab },
  { id: 'players', label: 'Players', render: playersTab },
  { id: 'seasons', label: 'Seasons', render: seasonsTab },
  { id: 'events', label: 'Events', render: eventsTab },
  { id: 'log', label: 'Change log', render: logTab },
  { id: 'editors', label: 'Editors', render: editorsTab, adminOnly: true },
];

function renderApp() {
  const tabs = TABS.filter((t) => !t.adminOnly || isAdmin());
  const panel = h('div', { class: 'panel', role: 'tabpanel' });
  const buttons = tabs.map((t) => h('button', {
    type: 'button', role: 'tab', class: 'tab', 'data-tab': t.id,
    onclick: () => show(t.id),
  }, t.label));
  async function show(id: string) {
    const t = tabs.find((x) => x.id === id) ?? tabs[0];
    remember('tab', t.id);
    for (const b of buttons) b.setAttribute('aria-selected', String(b.dataset.tab === t.id));
    clear(panel, h('p', { class: 'muted' }, 'Loading…'));
    try { clear(panel); await t.render(panel); }
    catch (e) { clear(panel, h('p', { class: 'status err' }, e instanceof Error ? e.message : String(e))); }
  }
  clear(root,
    h('div', { class: 'who' },
      h('span', {}, 'Signed in as ', h('strong', {}, editor!.name), ` (${editor!.role})`),
      signOutButton()),
    h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Admin sections' }, buttons),
    panel,
  );
  show(remember('tab') ?? 'results');
}

function dialog(title: string, body: HTMLElement[], onSave: (st: ReturnType<typeof status>) => Promise<string | void>, extra: HTMLElement[] = []) {
  const st = status();
  const save = h('button', { type: 'submit', class: 'btn' }, 'Save');
  const close = h('button', { type: 'button', class: 'btn ghost', onclick: () => dlg.close() }, 'Close');
  const form = h('form', { method: 'dialog', class: 'dlg-body' }, h('h2', {}, title), body, h('div', { class: 'row' }, save, close, extra), st);
  const dlg = h('dialog', { class: 'dlg' }, form);
  form.addEventListener('submit', (ev) => { ev.preventDefault(); busy(save, st, () => onSave(st)); });
  dlg.addEventListener('close', () => dlg.remove());
  document.body.appendChild(dlg);
  dlg.showModal();
  return { dlg, st };
}

const groupOptions = (): [string, string][] => [['', '(no group)'], ...groups.map((g) => [g.id, g.name] as [string, string])];

// ------------------------------------------------------------------ results

const COLS: Record<string, string> = {
  bracket: 'Bracket', rank: 'Rank', name: 'Name', score: 'Score', time: 'Time (h:mm:ss)', server: 'Server',
  player_id: 'Player ID', guild_name: 'Guild name', leader_name: 'Leader name', leader_id: 'Leader ID',
  essence_rank: 'Essence rank', essence_m: 'Essence (M)',
};
function pasteColumns(ev: EventRow): string[] {
  if (ev.has_brackets) return ['bracket', 'rank', 'name', 'score'];
  if (ev.ranks === 'player') return ['rank', 'name', 'player_id', 'score', 'server', 'guild_name'];
  if (ev.has_time) return ['rank', 'name', 'score', 'time', 'server', 'leader_name', 'leader_id', 'essence_rank', 'essence_m'];
  return ['rank', 'name', 'score', 'server'];
}

async function resultsTab(panel: HTMLElement) {
  if (!seasons.length) return clear(panel, h('p', {}, 'Add a season first, on the Seasons tab.'));
  const ordered = [...seasons].sort((a, b) => b.sort_order - a.sort_order);
  const sel = select(ordered.map((s) => [s.id, seasonLabel(s)]), remember('season') ?? ordered[0].id);
  const listBox = h('div', { class: 'table-wrap tall' });
  const addBox = h('div');
  sel.addEventListener('change', () => { remember('season', sel.value); load(); });
  clear(panel, h('div', { class: 'row' }, field('Season', sel)), addBox, listBox);

  async function load() {
    const season = seasons.find((s) => s.id === sel.value)!;
    const ev = eventOf(season);
    const rows = check(await sb.from('results').select('*').eq('season_id', season.id)
      .order('bracket', { nullsFirst: true }).order('rank', { nullsFirst: false }).order('id')) as Result[];
    clear(addBox, addResults(season, ev, load));
    const t = h('table', { class: 'rank' },
      h('thead', {}, h('tr', {},
        ev.has_brackets && h('th', {}, 'Bracket'),
        h('th', {}, 'Rank'), h('th', {}, 'Listed as'), h('th', {}, ev.ranks === 'player' ? 'Player · Guild' : 'Guild'),
        h('th', { class: 'num' }, ev.score_label), ev.has_time && h('th', {}, 'Time'), h('th', {}, 'Server'), h('th', {}, ''))),
      h('tbody', {}, rows.map((r) => h('tr', {},
        ev.has_brackets && h('td', {}, r.bracket ?? ''),
        h('td', {}, r.rank ?? '—'),
        h('td', {}, r.listed_name),
        h('td', {}, ev.ranks === 'player' ? `${playerById.get(r.player_id ?? '')?.name ?? r.player_id} · ${guildLabel(r.guild_id)}` : guildLabel(r.guild_id)),
        h('td', { class: 'num' }, (r.score_rounded ? '≈ ' : '') + fmtInt(r.score)),
        ev.has_time && h('td', {}, fmtTime(r.time_seconds)),
        h('td', {}, r.server ?? ''),
        h('td', {}, h('button', { type: 'button', class: 'btn small', onclick: () => editResult(r, ev, load) }, 'Edit')),
      ))),
    );
    clear(listBox, rows.length ? [h('p', { class: 'muted small' }, `${rows.length} results`), t] : h('p', { class: 'empty-note' }, 'No results in this season yet.'));
  }
  await load();
}

function editResult(r: Result, ev: EventRow, reload: () => void) {
  const f = {
    listed: text(r.listed_name), guild: text(r.guild_id), player: text(r.player_id),
    bracket: num(r.bracket), rank: num(r.rank), score: num(r.score), rounded: box(r.score_rounded),
    time: text(fmtTime(r.time_seconds)), server: num(r.server), extra: area(JSON.stringify(r.extra ?? {}, null, 1), { rows: 4 }),
  };
  const del = isAdmin() ? h('button', { type: 'button', class: 'btn danger' }, 'Delete') : null;
  const { dlg, st } = dialog(`Edit result: ${r.listed_name}`, [
    field('Listed as', f.listed, 'The name exactly as the ranking showed it.'),
    field('Guild ID', f.guild, guildLabel(r.guild_id)),
    ev.ranks === 'player' ? field('Player ID', f.player) : null,
    h('div', { class: 'grid' },
      ev.has_brackets ? field('Bracket', f.bracket) : null,
      field('Rank', f.rank), field(ev.score_label, f.score),
      ev.has_time ? field('Time', f.time) : null, field('Server', f.server)),
    h('label', { class: 'inline' }, f.rounded, ' Rounded by the game (like 13M)'),
    field('Other fields (JSON)', f.extra, 'Leader, essence and similar event-specific values.'),
  ].filter(Boolean) as HTMLElement[], async () => {
    const guildId = blank(f.guild.value);
    if (guildId && !guildById.has(guildId)) throw new Error(`No guild with ID ${guildId}.`);
    let extra: Record<string, unknown>;
    try { extra = JSON.parse(f.extra.value || '{}'); } catch { throw new Error('Other fields is not valid JSON.'); }
    check(await sb.from('results').update({
      listed_name: f.listed.value.trim(), guild_id: guildId, player_id: blank(f.player.value),
      bracket: parseInt0(f.bracket.value), rank: parseInt0(f.rank.value), score: parseNum(f.score.value),
      score_rounded: f.rounded.checked, time_seconds: parseTime(f.time.value), server: parseInt0(f.server.value), extra,
    }).eq('id', r.id));
    reload();
    return 'Saved.';
  }, del ? [del] : []);
  del?.addEventListener('click', async () => {
    if (!confirm(`Delete the result for "${r.listed_name}"? This can't be undone (the change log keeps a copy).`)) return;
    try { check(await sb.from('results').delete().eq('id', r.id)); dlg.close(); reload(); } catch (e) { st.err(e); }
  });
}

function addResults(season: Season, ev: EventRow, reload: () => void) {
  const cols = pasteColumns(ev);
  const input = area('', { rows: 8, spellcheck: false, placeholder: cols.map((c) => COLS[c]).join('\t') });
  const preview = h('div');
  const st = status();
  const previewBtn = h('button', { type: 'button', class: 'btn' }, 'Preview');
  let parsed: ParsedRow[] = [];

  type ParsedRow = { v: Record<string, string>; guildName: string; matched: string | null; override: HTMLInputElement };

  previewBtn.addEventListener('click', () => {
    try {
      parsed = [];
      for (const line of input.value.split(/\r?\n/)) {
        if (!line.trim()) continue;
        const cells = line.includes('\t') ? line.split('\t') : line.split(',');
        if (/^(rank|bracket)$/i.test(cells[0].trim())) continue; // header row
        const v: Record<string, string> = {};
        cols.forEach((c, i) => { v[c] = (cells[i] ?? '').trim(); });
        if (!v.name) throw new Error(`A line has no name: "${line}"`);
        const guildName = ev.ranks === 'player' ? v.guild_name : v.name;
        parsed.push({ v, guildName, matched: guildName ? guildBySpelling.get(guildName) ?? null : null, override: text('', { placeholder: 'new guild', class: 'narrow' }) });
      }
      if (!parsed.length) throw new Error('Nothing to add. Paste rows first.');
      const newCount = parsed.filter((p) => p.guildName && !p.matched).length;
      const go = h('button', { type: 'button', class: 'btn' }, `Add ${parsed.length} results`);
      go.addEventListener('click', () => busy(go, st, () => commit()));
      clear(preview,
        h('p', { class: 'muted small' }, newCount
          ? `${newCount} guild name(s) aren't known yet. They'll be added as new guilds, unless you type an existing guild ID next to them.`
          : 'Every guild name matched a known guild.'),
        h('div', { class: 'table-wrap tall' }, h('table', { class: 'rank' },
          h('thead', {}, h('tr', {}, cols.map((c) => h('th', {}, COLS[c])), h('th', {}, 'Guild match'))),
          h('tbody', {}, parsed.map((p) => h('tr', {},
            cols.map((c) => h('td', {}, p.v[c])),
            h('td', {}, !p.guildName ? '—' : p.matched ? guildLabel(p.matched) : p.override)))))),
        go);
      st.info('');
    } catch (e) { st.err(e); }
  });

  async function commit() {
    // 1. Guilds: typed IDs must exist; unknown names become new guilds (one per distinct name).
    const created = new Map<string, string>();
    let next = await nextGuildId();
    const bump = (id: string) => 'g' + String(+id.slice(1) + 1).padStart(3, '0');
    const resolved: (string | null)[] = [];
    for (const p of parsed) {
      if (!p.guildName) { resolved.push(null); continue; }
      if (p.matched) { resolved.push(p.matched); continue; }
      const typed = p.override.value.trim();
      if (typed) {
        if (!guildById.has(typed)) throw new Error(`No guild with ID ${typed}.`);
        if (!guildBySpelling.has(p.guildName)) {
          check(await sb.from('guild_names').insert({ name: p.guildName, guild_id: typed, notes: `Spelling used in ${season.id}` }));
          guildBySpelling.set(p.guildName, typed);
        }
        resolved.push(typed);
        continue;
      }
      if (!created.has(p.guildName)) {
        const id = next; next = bump(next);
        check(await sb.from('guilds').insert({ id, name: p.guildName, notes: `First seen in ${season.id}` }));
        check(await sb.from('guild_names').insert({ name: p.guildName, guild_id: id }));
        created.set(p.guildName, id);
        guildBySpelling.set(p.guildName, id);
      }
      resolved.push(created.get(p.guildName)!);
    }
    // 2. Players (player events): add any player ID not seen before.
    if (ev.ranks === 'player') {
      const fresh = parsed.filter((p, i) => p.v.player_id && !playerById.has(p.v.player_id) && parsed.findIndex((q) => q.v.player_id === p.v.player_id) === i);
      if (fresh.some((p) => !p.v.player_id)) throw new Error('Every row needs a player ID.');
      if (fresh.length) check(await sb.from('players').insert(fresh.map((p) => ({ id: p.v.player_id, name: p.v.name, guild_id: resolved[parsed.indexOf(p)] }))));
    }
    // 3. Results.
    const rows = parsed.map((p, i) => {
      const extra: Record<string, unknown> = {};
      if (p.v.guild_name && ev.ranks === 'player') extra.guild_name = p.v.guild_name;
      if (p.v.time) extra.clear_time = p.v.time;
      if (p.v.leader_name) extra.leader_name = p.v.leader_name;
      if (p.v.leader_id) extra.leader_id = p.v.leader_id;
      if (p.v.essence_rank) extra.essence_rank = parseInt0(p.v.essence_rank);
      if (p.v.essence_m) extra.essence_m = parseNum(p.v.essence_m);
      return {
        season_id: season.id, listed_name: p.v.name, guild_id: resolved[i], player_id: blank(p.v.player_id ?? ''),
        bracket: p.v.bracket ? parseInt0(p.v.bracket) : null, rank: parseInt0(p.v.rank ?? ''),
        score: parseNum(p.v.score ?? ''), score_rounded: isRounded(p.v.score ?? ''),
        time_seconds: parseTime(p.v.time ?? ''), server: parseInt0(p.v.server ?? ''), extra,
      };
    });
    check(await sb.from('results').insert(rows));
    await loadAll();
    input.value = '';
    clear(preview);
    reload();
    return `Added ${rows.length} results${created.size ? ` and ${created.size} new guild(s)` : ''}.`;
  }

  return h('details', { class: 'card add' },
    h('summary', {}, 'Add results by pasting'),
    h('p', { class: 'muted small' }, 'Paste rows straight from a spreadsheet (tab-separated) or as comma-separated text, one result per line, in this column order:'),
    h('ol', { class: 'cols' }, cols.map((c) => h('li', {}, COLS[c]))),
    h('p', { class: 'muted small' }, 'Leave trailing columns empty if you don\'t have them. Scores like 13M are saved as 13,000,000 and marked rounded. Guild names are matched to known spellings.'),
    input, h('div', { class: 'row' }, previewBtn), preview, st);
}

// ------------------------------------------------------------------ guilds

function guildsTab(panel: HTMLElement) {
  const q = text('', { type: 'search', placeholder: 'Search name, spelling or ID', class: 'filter' });
  const list = h('div', { class: 'table-wrap tall' });
  const newBtn = h('button', { type: 'button', class: 'btn', onclick: () => editGuild(null, draw) }, 'New guild');
  q.addEventListener('input', draw);
  clear(panel, h('div', { class: 'row' }, q, newBtn), list);
  function draw() {
    const term = q.value.trim().toLowerCase();
    const hits = guilds.filter((g) => !term || g.id.toLowerCase().includes(term) || g.name.toLowerCase().includes(term)
      || spellings.some((s) => s.guild_id === g.id && s.name.toLowerCase().includes(term))).slice(0, 100);
    clear(list, h('table', { class: 'rank' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Guild'), h('th', {}, 'ID'), h('th', {}, 'Server'), h('th', {}, 'Group'), h('th', {}, ''), h('th', {}, ''))),
      h('tbody', {}, hits.map((g) => h('tr', {},
        h('td', {}, g.name), h('td', {}, g.id), h('td', {}, g.home_server ?? ''),
        h('td', {}, groups.find((x) => x.id === g.group_id)?.name ?? ''),
        h('td', {}, g.inactive ? 'inactive' : ''),
        h('td', {}, h('button', { type: 'button', class: 'btn small', onclick: () => editGuild(g, draw) }, 'Edit')))))),
      hits.length === 100 ? h('p', { class: 'muted small' }, 'Showing the first 100. Search to narrow it down.') : null);
  }
  draw();
}

function editGuild(g: Guild | null, redraw: () => void) {
  const f = {
    id: text(g?.id ?? '', { placeholder: 'leave empty for an auto ID' }), name: text(g?.name ?? ''), server: num(g?.home_server),
    group: select(groupOptions(), g?.group_id ?? ''), inactive: box(g?.inactive ?? false), notes: area(g?.notes, { rows: 2 }),
  };
  const mine = g ? spellings.filter((s) => s.guild_id === g.id) : [];
  const newSpelling = text('', { placeholder: 'Another spelling seen in a ranking' });
  const spellBox = g ? h('div', { class: 'fld' },
    h('span', { class: 'lbl' }, 'Spellings seen'),
    h('ul', { class: 'spellings' }, mine.map((s) => h('li', {}, s.name, s.notes ? h('span', { class: 'muted small' }, ` (${s.notes})`) : null))),
    h('div', { class: 'row' }, newSpelling,
      h('button', { type: 'button', class: 'btn small', onclick: async () => {
        const name = newSpelling.value.trim();
        if (!name) return;
        try {
          check(await sb.from('guild_names').insert({ name, guild_id: g.id }));
          await loadAll(); dlg.close(); editGuild(guildById.get(g.id)!, redraw);
        } catch (e) { st.err(e); }
      } }, 'Add spelling'))) : null;
  const mergeTo = text('', { placeholder: 'ID of the guild to keep' });
  const mergeBox = g && isAdmin() ? h('details', { class: 'fld' },
    h('summary', {}, 'Merge into another guild (admin)'),
    h('p', { class: 'muted small' }, 'Moves this guild\'s spellings, results and players to the other guild, then deletes this one.'),
    h('div', { class: 'row' }, mergeTo, h('button', { type: 'button', class: 'btn danger small', onclick: async () => {
      const to = mergeTo.value.trim();
      try {
        if (!guildById.has(to) || to === g.id) throw new Error('Type the ID of a different, existing guild.');
        if (!confirm(`Merge "${g.name}" into "${guildById.get(to)!.name}"? "${g.name}" will be deleted.`)) return;
        check(await sb.from('guild_names').update({ guild_id: to }).eq('guild_id', g.id));
        check(await sb.from('results').update({ guild_id: to }).eq('guild_id', g.id));
        check(await sb.from('players').update({ guild_id: to }).eq('guild_id', g.id));
        check(await sb.from('guilds').delete().eq('id', g.id));
        await loadAll(); dlg.close(); redraw();
      } catch (e) { st.err(e); }
    } }, 'Merge'))) : null;

  const { dlg, st } = dialog(g ? `Edit guild: ${g.name}` : 'New guild', [
    field('Guild ID', f.id, g ? 'Swap in the game\'s guild ID when you learn it. Results and spellings follow automatically.' : 'The game\'s guild ID if you know it.'),
    field('Current name', f.name),
    h('div', { class: 'grid' }, field('Home server', f.server), field('Group', f.group)),
    h('label', { class: 'inline' }, f.inactive, ' Inactive'),
    field('Notes', f.notes),
    spellBox, mergeBox,
  ].filter(Boolean) as HTMLElement[], async () => {
    const name = f.name.value.trim();
    if (!name) throw new Error('A guild needs a name.');
    const row = { name, home_server: parseInt0(f.server.value), group_id: f.group.value || null, inactive: f.inactive.checked, notes: blank(f.notes.value) };
    const id = f.id.value.trim();
    if (g) {
      check(await sb.from('guilds').update({ ...row, id: id || g.id }).eq('id', g.id));
    } else {
      const newId = id || await nextGuildId();
      check(await sb.from('guilds').insert({ ...row, id: newId }));
      if (!guildBySpelling.has(name)) check(await sb.from('guild_names').insert({ name, guild_id: newId }));
    }
    await loadAll();
    redraw();
    return g ? 'Saved.' : 'Guild added.';
  });
}

// ------------------------------------------------------------------ players

function playersTab(panel: HTMLElement) {
  const q = text('', { type: 'search', placeholder: 'Search name or ID', class: 'filter' });
  const list = h('div', { class: 'table-wrap tall' });
  q.addEventListener('input', draw);
  clear(panel, h('div', { class: 'row' }, q, h('button', { type: 'button', class: 'btn', onclick: () => editPlayer(null, draw) }, 'New player')), list);
  function draw() {
    const term = q.value.trim().toLowerCase();
    const hits = players.filter((p) => !term || p.id.includes(term) || p.name.toLowerCase().includes(term)).slice(0, 100);
    clear(list, h('table', { class: 'rank' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Player'), h('th', {}, 'ID'), h('th', {}, 'Guild'), h('th', {}, ''), h('th', {}, ''))),
      h('tbody', {}, hits.map((p) => h('tr', {},
        h('td', {}, p.name), h('td', {}, p.id), h('td', {}, guildLabel(p.guild_id)), h('td', {}, p.inactive ? 'inactive' : ''),
        h('td', {}, h('button', { type: 'button', class: 'btn small', onclick: () => editPlayer(p, draw) }, 'Edit')))))));
  }
  draw();
}

function editPlayer(p: Player | null, redraw: () => void) {
  const f = { id: text(p?.id ?? ''), name: text(p?.name ?? ''), guild: text(p?.guild_id ?? ''), inactive: box(p?.inactive ?? false), notes: area(p?.notes, { rows: 2 }) };
  const del = p && isAdmin() ? h('button', { type: 'button', class: 'btn danger' }, 'Delete') : null;
  const { dlg, st } = dialog(p ? `Edit player: ${p.name}` : 'New player', [
    field('Player ID', f.id, 'The in-game player ID.'),
    field('Current name', f.name),
    field('Guild ID', f.guild, p?.guild_id ? guildLabel(p.guild_id) : 'Optional.'),
    h('label', { class: 'inline' }, f.inactive, ' Inactive'),
    field('Notes', f.notes),
  ], async () => {
    const id = f.id.value.trim();
    const name = f.name.value.trim();
    const guild = blank(f.guild.value);
    if (!id || !name) throw new Error('A player needs an ID and a name.');
    if (guild && !guildById.has(guild)) throw new Error(`No guild with ID ${guild}.`);
    const row = { id, name, guild_id: guild, inactive: f.inactive.checked, notes: blank(f.notes.value) };
    if (p) check(await sb.from('players').update(row).eq('id', p.id));
    else check(await sb.from('players').insert(row));
    await loadAll();
    redraw();
    return p ? 'Saved.' : 'Player added.';
  }, del ? [del] : []);
  del?.addEventListener('click', async () => {
    if (!confirm(`Delete player "${p!.name}"? Players with results can't be deleted.`)) return;
    try { check(await sb.from('players').delete().eq('id', p!.id)); await loadAll(); dlg.close(); redraw(); } catch (e) { st.err(e); }
  });
}

// ------------------------------------------------------------------ seasons

function seasonsTab(panel: HTMLElement) {
  const draw = () => {
    const ordered = [...seasons].sort((a, b) => b.sort_order - a.sort_order);
    clear(panel,
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: () => editSeason(null, draw) }, 'New season')),
      h('div', { class: 'table-wrap' }, h('table', { class: 'rank' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Order'), h('th', {}, 'Season'), h('th', {}, 'Title'), h('th', {}, 'Ended'), h('th', {}, ''))),
        h('tbody', {}, ordered.map((s) => h('tr', {},
          h('td', {}, s.sort_order), h('td', {}, seasonLabel(s)), h('td', {}, s.title), h('td', {}, s.end_date ?? ''),
          h('td', {}, h('button', { type: 'button', class: 'btn small', onclick: () => editSeason(s, draw) }, 'Edit'))))))));
  };
  draw();
}

function editSeason(s: Season | null, redraw: () => void) {
  const nextOrder = Math.max(0, ...seasons.map((x) => x.sort_order)) + 1;
  const f = {
    id: text(s?.id ?? '', { placeholder: 'like alna-s3' }),
    event: select(events.map((e) => [e.id, e.show_on_site ? e.name : `${e.name} (not on site yet)`]), s?.event_id ?? events[0]?.id ?? ''),
    number: num(s?.season_number), title: text(s?.title ?? ''), end: h('input', { type: 'date', value: s?.end_date ?? '' }),
    order: num(s?.sort_order ?? nextOrder), max: num(s?.max_score), by: text(s?.compiled_by ?? ''), thanks: text(s?.thanks ?? ''),
    url: text(s?.source_url ?? ''), notes: area(s?.notes, { rows: 3 }),
  };
  const del = s && isAdmin() ? h('button', { type: 'button', class: 'btn danger' }, 'Delete') : null;
  const { dlg, st } = dialog(s ? `Edit season: ${s.id}` : 'New season', [
    h('div', { class: 'grid' }, field('Season ID', f.id), field('Event', f.event), field('Season number', f.number)),
    field('Title', f.title, 'The ranking\'s own title.'),
    h('div', { class: 'grid' }, field('End date', f.end), field('Order', f.order, 'Higher = more recent.'), field('Max damage (M)', f.max, 'AbEx only.')),
    field('Gathered by', f.by), field('Thanks', f.thanks), field('Source link', f.url), field('Notes', f.notes),
  ], async () => {
    const id = f.id.value.trim();
    if (!id || !f.title.value.trim()) throw new Error('A season needs an ID and a title.');
    const row = {
      id, event_id: f.event.value, season_number: parseInt0(f.number.value), title: f.title.value.trim(),
      end_date: f.end.value || null, sort_order: parseInt0(f.order.value) ?? nextOrder, max_score: parseNum(f.max.value),
      compiled_by: blank(f.by.value), thanks: blank(f.thanks.value), source_url: blank(f.url.value), notes: blank(f.notes.value),
    };
    if (s) check(await sb.from('seasons').update(row).eq('id', s.id));
    else check(await sb.from('seasons').insert(row));
    await loadAll();
    redraw();
    return s ? 'Saved.' : 'Season added. Add its results on the Results tab.';
  }, del ? [del] : []);
  del?.addEventListener('click', async () => {
    if (!confirm(`Delete season ${s!.id}? Only works once it has no results.`)) return;
    try { check(await sb.from('seasons').delete().eq('id', s!.id)); await loadAll(); dlg.close(); redraw(); } catch (e) { st.err(e); }
  });
}

// ------------------------------------------------------------------ events

const layoutOf = (e: Pick<EventRow, 'ranks' | 'has_brackets' | 'has_time'>) =>
  e.has_brackets ? 'Bracket, Rank, Name, Score'
    : e.ranks === 'player' ? 'Rank, Player name, Player ID, Score, Server, Guild name'
    : e.has_time ? 'Rank, Guild name, Score, Time, Server, Leader name, Leader ID, Essence rank, Essence (M)'
    : 'Rank, Guild name, Score, Server';

function eventsTab(panel: HTMLElement) {
  const draw = () => {
    const count = (id: string) => seasons.filter((s) => s.event_id === id).length;
    clear(panel,
      h('p', { class: 'muted small' }, 'Each event describes what its rankings measure. New events can be filled in here right away; they stay off the public site until a page layout is made for them.'),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: () => editEvent(null, draw) }, 'New event')),
      h('div', { class: 'table-wrap' }, h('table', { class: 'rank' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Event'), h('th', {}, 'Ranks'), h('th', {}, 'Score'), h('th', {}, 'Brackets'), h('th', {}, 'Time'), h('th', {}, 'Seasons'), h('th', {}, 'On site'), h('th', {}, ''))),
        h('tbody', {}, [...events].sort((a, b) => a.name.localeCompare(b.name)).map((e) => h('tr', {},
          h('td', {}, e.name, h('span', { class: 'listed' }, e.id)), h('td', {}, e.ranks === 'player' ? 'Players' : 'Guilds'),
          h('td', {}, e.score_label), h('td', {}, e.has_brackets ? 'Yes' : ''), h('td', {}, e.has_time ? 'Yes' : ''),
          h('td', {}, count(e.id)), h('td', {}, e.show_on_site ? 'Yes' : h('span', { class: 'muted' }, 'Not yet')),
          h('td', {}, h('button', { type: 'button', class: 'btn small', onclick: () => editEvent(e, draw) }, 'Edit'))))))));
  };
  draw();
}

function editEvent(e: EventRow | null, redraw: () => void) {
  const f = {
    id: text(e?.id ?? '', { placeholder: 'like guild-war' }), name: text(e?.name ?? ''),
    ranks: select([['guild', 'Guilds'], ['player', 'Players']], e?.ranks ?? 'guild'),
    score: text(e?.score_label ?? '', { placeholder: 'like Points, Damage (M), Floor' }),
    brackets: box(e?.has_brackets ?? false), time: box(e?.has_time ?? false), notes: area(e?.notes, { rows: 2 }),
    site: box(e?.show_on_site ?? false, { disabled: !isAdmin() }),
  };
  const layout = h('p', { class: 'hint' });
  const showLayout = () => { layout.textContent = `Paste columns for its results: ${layoutOf({ ranks: f.ranks.value as 'guild' | 'player', has_brackets: f.brackets.checked, has_time: f.time.checked })}`; };
  for (const c of [f.ranks, f.brackets, f.time]) c.addEventListener('change', showLayout);
  showLayout();
  const seasonCount = e ? seasons.filter((s) => s.event_id === e.id).length : 0;
  const del = e && isAdmin() ? h('button', { type: 'button', class: 'btn danger' }, 'Delete') : null;
  const { dlg, st } = dialog(e ? `Edit event: ${e.name}` : 'New event', [
    h('div', { class: 'grid' }, field('Event ID', f.id, e && seasonCount ? 'Changing it updates its seasons too.' : 'Short, lowercase, no spaces.'), field('Name', f.name, 'As shown in the game.')),
    h('div', { class: 'grid' }, field('Ranks', f.ranks, 'Who the ranking lists.'), field('Score is', f.score, 'What the number means.')),
    h('label', { class: 'inline' }, f.brackets, ' Played in brackets (each bracket ranked separately, like Alna)'),
    h('label', { class: 'inline' }, f.time, ' Records a finish or last-attack time (like AbEx)'),
    layout,
    field('Notes', f.notes, 'How the event works, how it is scored, anything worth remembering.'),
    h('label', { class: 'inline' }, f.site, ' Shown on the public site'),
    h('p', { class: 'hint' }, isAdmin()
      ? 'Leave this off for new events: the site only has page layouts for AbEx, Temporal Rift and Alna so far. Ask for a layout first.'
      : 'Only an admin can change this.'),
  ], async () => {
    const id = f.id.value.trim().toLowerCase();
    const name = f.name.value.trim();
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error('The event ID needs lowercase letters, numbers or dashes, like guild-war.');
    if (!name || !f.score.value.trim()) throw new Error('Fill in the name and what the score is.');
    const row = {
      id, name, ranks: f.ranks.value, score_label: f.score.value.trim(), has_brackets: f.brackets.checked, has_time: f.time.checked,
      notes: blank(f.notes.value), ...(isAdmin() ? { show_on_site: f.site.checked } : {}),
    };
    if (e) check(await sb.from('events').update(row).eq('id', e.id));
    else check(await sb.from('events').insert(row));
    await loadAll();
    redraw();
    return e ? 'Saved.' : 'Event added. Now add its first season on the Seasons tab.';
  }, del ? [del] : []);
  del?.addEventListener('click', async () => {
    if (!confirm(`Delete the event "${e!.name}"? Only works once it has no seasons.`)) return;
    try { check(await sb.from('events').delete().eq('id', e!.id)); await loadAll(); dlg.close(); redraw(); } catch (err) { st.err(err); }
  });
}

// ------------------------------------------------------------------ change log

async function logTab(panel: HTMLElement) {
  const [log, eds] = await Promise.all([
    sb.from('change_log').select('*').not('changed_by', 'is', null).order('changed_at', { ascending: false }).limit(150),
    sb.from('editors').select('user_id,name'),
  ]);
  const rows = check(log) as { id: number; table_name: string; action: string; old_row: any; new_row: any; changed_by: string; changed_at: string }[];
  const names = new Map((check(eds) as { user_id: string; name: string }[]).map((e) => [e.user_id, e.name]));
  const what = (r: typeof rows[number]) => {
    const row = r.new_row ?? r.old_row ?? {};
    return row.listed_name ? `${row.listed_name} (${row.season_id})` : row.name ? `${row.name}${row.id ? ` · ${row.id}` : ''}` : row.id ?? '';
  };
  const diff = (r: typeof rows[number]) => {
    if (r.action !== 'UPDATE') return r.action === 'INSERT' ? 'added' : 'deleted';
    return Object.keys(r.new_row).filter((k) => k !== 'updated_at' && JSON.stringify(r.new_row[k]) !== JSON.stringify(r.old_row[k]))
      .map((k) => `${k}: ${JSON.stringify(r.old_row[k])} → ${JSON.stringify(r.new_row[k])}`).join('; ');
  };
  clear(panel,
    h('p', { class: 'muted small' }, 'The latest 150 changes made by editors. The original import from the sheet is not shown.'),
    rows.length ? h('div', { class: 'table-wrap tall' }, h('table', { class: 'rank' },
      h('thead', {}, h('tr', {}, h('th', {}, 'When'), h('th', {}, 'Who'), h('th', {}, 'Table'), h('th', {}, 'Row'), h('th', {}, 'Change'))),
      h('tbody', {}, rows.map((r) => h('tr', {},
        h('td', {}, new Date(r.changed_at).toLocaleString()), h('td', {}, names.get(r.changed_by) ?? r.changed_by.slice(0, 8)),
        h('td', {}, r.table_name), h('td', {}, what(r)), h('td', { class: 'wrapcell' }, diff(r)))))))
      : h('p', { class: 'empty-note' }, 'No changes yet.'));
}

// ------------------------------------------------------------------ editors (admin)

async function editorsTab(panel: HTMLElement) {
  const list = check(await sb.from('editors').select('user_id,name,role,created_at').order('created_at')) as (Editor & { created_at: string })[];
  const f = { id: text('', { placeholder: 'user ID they send you' }), name: text(''), role: select([['helper', 'Helper: add and fix'], ['admin', 'Admin: also delete']], 'helper') };
  const st = status();
  const add = h('button', { type: 'button', class: 'btn' }, 'Add editor');
  add.addEventListener('click', () => busy(add, st, async () => {
    if (!f.id.value.trim() || !f.name.value.trim()) throw new Error('Fill in the user ID and a name.');
    check(await sb.from('editors').insert({ user_id: f.id.value.trim(), name: f.name.value.trim(), role: f.role.value }));
    await editorsTab(panel);
    return 'Editor added.';
  }));
  clear(panel,
    h('div', { class: 'table-wrap' }, h('table', { class: 'rank' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Name'), h('th', {}, 'Role'), h('th', {}, 'User ID'), h('th', {}, ''))),
      h('tbody', {}, list.map((e) => h('tr', {},
        h('td', {}, e.name), h('td', {}, e.role), h('td', {}, h('code', {}, e.user_id)),
        h('td', {}, e.user_id === me!.id ? h('span', { class: 'muted small' }, 'you') : h('button', { type: 'button', class: 'btn small danger', onclick: async () => {
          if (!confirm(`Remove ${e.name} as an editor?`)) return;
          try { check(await sb.from('editors').delete().eq('user_id', e.user_id)); await editorsTab(panel); } catch (err) { alert(err instanceof Error ? err.message : String(err)); }
        } }, 'Remove'))))))),
    h('section', { class: 'card' },
      h('h2', {}, 'Add an editor'),
      h('p', { class: 'muted small' }, 'Create their login in Supabase (Authentication → Users → Add user). When they sign in here they\'ll see their user ID; paste it below.'),
      h('div', { class: 'grid' }, field('User ID', f.id), field('Name', f.name), field('Role', f.role)),
      h('div', { class: 'row' }, add), st));
}

start();
