// Renders the admin and helper guides as PNG images (guides/*.png) to send to editors.
// Run: node scripts/make-guides.mjs   (edit the text below and rerun to update them)
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';

const out = new URL('../guides/', import.meta.url);
await mkdir(out, { recursive: true });

const W = 1080, PAD = 64, INNER = W - PAD * 2;
const C = { bg: '#0d1220', card: '#151c2f', raised: '#1a2238', line: '#27314a', ink: '#e7ebf4', muted: '#9aa4ba', gold: '#e0b04a', blue: '#6fb0ff', red: '#ff8a7a' };
const SANS = 'Segoe UI, Inter, Arial, sans-serif';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const mark = `
  <path d="M32 3 L57 11 V30 C57 46 46 57 32 61 C18 57 7 46 7 30 V11 Z" fill="#d9a83a"/>
  <path d="M32 3 L57 11 V30 C57 46 46 57 32 61 Z" fill="#c69326"/>
  <path d="M32 7 L53 13.8 V30 C53 44 44 53.5 32 57 C20 53.5 11 44 11 30 V13.8 Z" fill="#6fb0ff"/>
  <path d="M32 9 L51 15 V30 C51 43 43 51.5 32 55 C21 51.5 13 43 13 30 V15 Z" fill="#151c2f"/>
  <rect x="17" y="35" width="9" height="11" rx="1" fill="#b4bfd0"/>
  <rect x="27.5" y="28" width="9" height="18" rx="1" fill="#e0b04a"/>
  <rect x="38" y="39" width="9" height="7" rx="1" fill="#cf8a5c"/>
  <path d="M32 11.5 L37.5 19 L32 26.5 L26.5 19 Z" fill="#3d8bff"/>
  <path d="M32 11.5 L37.5 19 L32 19 Z" fill="#9ccaff"/>`;

// Rough text width for wrapping (Segoe UI averages ~0.52em; bold a little wider).
const width = (s, size, bold) => [...s].reduce((w, ch) => w + (/[A-Z0-9#@MW]/.test(ch) ? 0.62 : /[il.,:;'|! ]/.test(ch) ? 0.3 : 0.53), 0) * size * (bold ? 1.06 : 1);

/** Wraps text with **bold** spans into lines of {text,bold} runs. */
function wrap(text, size, maxW) {
  const words = [];
  let bold = false;
  for (const part of text.split('**')) {
    for (const w of part.split(/ +/)) if (w) words.push({ w, bold, glue: /^[.,;:!?)]/.test(w) && !part.startsWith(' ') });
    bold = !bold;
  }
  const lines = [[]];
  let lineW = 0;
  for (const word of words) {
    const ww = width(word.w + ' ', size, word.bold);
    if (lineW + ww > maxW && lines.at(-1).length) { lines.push([]); lineW = 0; }
    lines.at(-1).push(word);
    lineW += ww;
  }
  return lines;
}
const runs = (line, color) => line.map((r, i) =>
  `<tspan font-weight="${r.bold ? 700 : 400}" fill="${r.bold ? C.ink : color}">${i > 0 && !r.glue ? ' ' : ''}${esc(r.w)}</tspan>`).join('');

function render(guide) {
  let y = 0;
  const parts = [];
  // Header band
  parts.push(`<rect width="${W}" height="210" fill="${C.card}"/><rect y="207" width="${W}" height="3" fill="${C.gold}"/>`);
  parts.push(`<g transform="translate(${PAD} 52) scale(1.75)">${mark}</g>`);
  parts.push(`<text x="${PAD + 132}" y="98" font-family="Cinzel, Trajan Pro, Georgia, serif" font-weight="700" font-size="46" fill="${C.ink}">${esc(guide.title)}</text>`);
  parts.push(`<text x="${PAD + 134}" y="142" font-family="${SANS}" font-size="24" fill="${C.muted}">${esc(guide.subtitle)}</text>`);
  y = 262;

  for (const b of guide.blocks) {
    if (b.h) {
      y += 18;
      parts.push(`<text x="${PAD}" y="${y + 30}" font-family="${SANS}" font-weight="700" font-size="30" fill="${C.gold}">${esc(b.h)}</text>`);
      y += 52;
    } else if (b.p || b.note) {
      const size = 24, lh = 36, color = b.note ? C.muted : C.ink;
      const x = b.note ? PAD + 24 : PAD;
      const lines = wrap(b.p || b.note, size, INNER - (b.note ? 48 : 0));
      if (b.note) parts.push(`<rect x="${PAD}" y="${y}" width="${INNER}" height="${lines.length * lh + 28}" rx="12" fill="${C.raised}" stroke="${C.line}"/><rect x="${PAD}" y="${y}" width="5" height="${lines.length * lh + 28}" rx="2" fill="${b.warn ? C.red : C.blue}"/>`);
      const top = y + (b.note ? 14 : 0);
      lines.forEach((ln, i) => parts.push(`<text x="${x}" y="${top + 26 + i * lh}" font-family="${SANS}" font-size="${size}" fill="${color}">${runs(ln, color)}</text>`));
      y = top + lines.length * lh + (b.note ? 14 : 0) + 14;
    } else if (b.steps || b.bullets) {
      const items = b.steps || b.bullets;
      items.forEach((it, n) => {
        const lines = wrap(it, 24, INNER - 64);
        if (b.steps) {
          parts.push(`<circle cx="${PAD + 20}" cy="${y + 18}" r="19" fill="${C.gold}"/><text x="${PAD + 20}" y="${y + 26}" text-anchor="middle" font-family="${SANS}" font-weight="700" font-size="22" fill="#1d1503">${n + 1}</text>`);
        } else {
          parts.push(`<circle cx="${PAD + 20}" cy="${y + 17}" r="6" fill="${C.blue}"/>`);
        }
        lines.forEach((ln, i) => parts.push(`<text x="${PAD + 58}" y="${y + 26 + i * 35}" font-family="${SANS}" font-size="24" fill="${C.ink}">${runs(ln, C.ink)}</text>`));
        y += lines.length * 35 + 16;
      });
      y += 4;
    } else if (b.table) {
      const [head, ...rows] = b.table;
      const colW = [210, INNER - 210];
      const rowH = (r) => Math.max(1, wrap(r[1], 22, colW[1] - 28).length) * 32 + 18;
      const total = 46 + rows.reduce((s, r) => s + rowH(r), 0);
      parts.push(`<rect x="${PAD}" y="${y}" width="${INNER}" height="${total}" rx="12" fill="${C.card}" stroke="${C.line}"/>`);
      parts.push(`<text x="${PAD + 18}" y="${y + 31}" font-family="${SANS}" font-weight="700" font-size="20" fill="${C.muted}" letter-spacing="1">${esc(head[0].toUpperCase())}</text>`);
      parts.push(`<text x="${PAD + colW[0]}" y="${y + 31}" font-family="${SANS}" font-weight="700" font-size="20" fill="${C.muted}" letter-spacing="1">${esc(head[1].toUpperCase())}</text>`);
      let ry = y + 46;
      for (const r of rows) {
        parts.push(`<line x1="${PAD}" x2="${PAD + INNER}" y1="${ry}" y2="${ry}" stroke="${C.line}"/>`);
        parts.push(`<text x="${PAD + 18}" y="${ry + 32}" font-family="${SANS}" font-weight="700" font-size="22" fill="${C.gold}">${esc(r[0])}</text>`);
        wrap(r[1], 22, colW[1] - 28).forEach((ln, i) => parts.push(`<text x="${PAD + colW[0]}" y="${ry + 32 + i * 32}" font-family="${SANS}" font-size="22" fill="${C.ink}">${runs(ln, C.ink)}</text>`));
        ry += rowH(r);
      }
      y += total + 18;
    }
  }
  y += 30;
  parts.push(`<rect y="${y}" width="${W}" height="80" fill="${C.card}"/><text x="${PAD}" y="${y + 50}" font-family="${SANS}" font-size="22" fill="${C.muted}">event-rankings.edenafk.com/admin</text><text x="${W - PAD}" y="${y + 50}" text-anchor="end" font-family="${SANS}" font-size="22" fill="${C.muted}">Made by Eden</text>`);
  const H = y + 80;
  return `<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${C.bg}"/>${parts.join('')}</svg>`;
}

// ------------------------------------------------------------------ shared text

const signIn = [{ h: 'Signing in' }, {
  steps: [
    'The admin creates your login and sends you the **email and password** privately. Keep them to yourself.',
    'Go to **event-rankings.edenafk.com/admin** and sign in.',
    'The first time, it says you\'re not an editor yet and shows a long **user ID**. Tap **Copy ID** and send it to the admin.',
    'Once the admin has added you, **reload the page**. You\'ll see the tabs: Results, Guilds, Players, Seasons, Change log.',
  ],
}];
const addResults = [
  { h: 'Adding a new season\'s results' },
  { steps: [
    '**Seasons** tab, **New season** (skip if it already exists). Fill in the ID (like **alna-s3**), event, season number, title, end date and who gathered it.',
    '**Results** tab, pick the season, open **Add results by pasting**.',
    'Copy the rows from your spreadsheet and paste them in, one result per line, in the column order shown (below).',
    'Tap **Preview**. Check every **Guild match**. Names we already know are matched for you.',
    'Unknown names become **new guilds**. If one is really a guild we already have under a new name, type that guild\'s **ID** in the box next to it instead.',
    'Tap **Add results**.',
  ] },
  { table: [
    ['Event', 'Columns, in order'],
    ['Alna', 'Bracket, Rank, Guild name, Points'],
    ['AbEx', 'Rank, Guild name, Damage (M), Time (h:mm:ss), Server, Leader name, Leader ID, Essence rank, Essence (M)'],
    ['Rift', 'Rank, Player name, Player ID, Floor, Server, Guild name'],
  ] },
  { note: 'Leave columns you don\'t have empty. A score shown in-game as **13M** is saved as 13,000,000 and marked as rounded.' },
];
const newEvent = [
  { h: 'A brand-new event' },
  { steps: [
    '**Events** tab, **New event**. Give it an ID (like **guild-war**), its in-game name, whether it ranks **guilds or players**, and what the **score** is (points, damage, floor...).',
    'Tick **brackets** if each bracket is ranked separately (like Alna), or **time** if it records a finish time (like AbEx). The form shows the paste columns that gives you.',
    'Then add its season on the **Seasons** tab and its results on the **Results** tab, as above.',
  ] },
  { note: 'New events are saved but **not shown on the public site** yet. They go live once a page layout is made for them.' },
];
const fixing = [
  { h: 'Fixing mistakes' },
  { bullets: [
    '**A result:** Results tab, pick the season, **Edit** on the row.',
    '**A guild:** Guilds tab, search, **Edit**. Change the name, home server, group, inactive, or notes.',
    '**Guild renamed?** Edit the guild, set **Current name**, and use **Add spelling** for the new name so future pastes match it.',
    '**Learned the real guild ID?** Edit the guild and replace its **Guild ID** (like g123) with the game\'s ID. Its results follow automatically.',
    '**A player:** Players tab, search, **Edit**.',
    '**A group** (like Eden or Sin): Groups tab. Set its name, tag text and color. To put a guild in a group, edit the guild.',
    '**A region:** Regions tab. Set its first and last server; it warns you if the range overlaps another region.',
  ] },
];
const goodHabits = [
  { h: 'Good habits' },
  { bullets: [
    'Type names **exactly as they appear in-game**, symbols and emoji included.',
    'Not sure two names are the same guild? **Ask an admin** instead of guessing.',
    'Every change is saved instantly and recorded in the **Change log** with your name.',
  ] },
];

const helper = {
  file: 'helper-guide.png',
  title: 'Helper guide',
  subtitle: 'Event Rankings editor area · adding and fixing results',
  blocks: [
    { p: 'As a **helper** you can **add and fix** seasons, results, guilds and players. You **can\'t delete** anything. If something needs removing, ask an admin.' },
    ...signIn, ...addResults, ...newEvent, ...fixing, ...goodHabits,
  ],
};

const admin = {
  file: 'admin-guide.png',
  title: 'Admin guide',
  subtitle: 'Event Rankings editor area · everything a helper does, plus more',
  blocks: [
    { p: 'As an **admin** you can do everything a helper can (add and fix results, guilds, players and seasons), plus **delete**, **merge guilds** and **manage editors**.' },
    { h: 'Adding a helper' },
    { steps: [
      'Open **supabase.com/dashboard**, project **Event Rankings**, then **Authentication > Users**.',
      'Tap **Add user > Create new user**. Enter their email and a password, keep **Auto Confirm User** ticked, and tap **Create user**.',
      'Send them the email and password **privately**, along with the Helper guide.',
      'They sign in at **/admin** and send you the **user ID** it shows them.',
      'In the admin area, **Editors** tab: paste the user ID, add their name, choose **Helper**, tap **Add editor**.',
    ] },
    { note: 'To remove someone, tap **Remove** next to them on the Editors tab. Choose **Admin** instead of Helper only for people you trust to delete things.' },
    { h: 'Admin-only actions' },
    { bullets: [
      '**Delete a result, player or season:** open it with **Edit**, then **Delete**. A season can only be deleted once it has no results.',
      '**Merge two guilds** (same guild, two entries): Guilds tab, **Edit** the one to remove, open **Merge into another guild**, type the ID of the one to keep, tap **Merge**. Its spellings, results and players move over.',
      '**Review what changed:** the **Change log** tab shows who changed what, with old and new values.',
    ] },
    { note: 'Deletes can\'t be undone from the admin area. The change log keeps a copy of what was removed, so ask **IDKTrout** if something needs to be restored.', warn: true },
    ...addResults, ...newEvent,
    { note: 'Only an admin can tick **Shown on the public site** for an event. Leave it off until the site has a layout for that event, or its results will show with the wrong labels.', warn: true },
    ...fixing, ...goodHabits,
  ],
};

for (const g of [helper, admin]) {
  const svg = render(g);
  await writeFile(new URL(g.file, out), await sharp(Buffer.from(svg), { density: 96 }).png().toBuffer());
  console.log('Wrote guides/' + g.file);
}
