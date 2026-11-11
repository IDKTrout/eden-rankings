// Downloads each tab of the published "AbEx Guild Rankings" sheet as CSV into src/data/.
// The site is built from those files, so this runs before every build.
//
// The publish ID comes from SHEET_PUB_ID (set it in Cloudflare Pages) or sheet.config.json.
// If a download fails, the copy already in src/data/ is kept so the build still works.

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const dataDir = new URL('src/data/', root);

// Tab name -> sheet gid (the number after #gid= in the sheet's address bar).
const TABS = {
  seasons: 1,
  abex_rankings: 0,
  rift_rankings: 3,
  guilds: 4,
  guild_names: 6,
  players: 5,
  groups: 7,
  regions: 8,
};

async function publishId() {
  if (process.env.SHEET_PUB_ID) return process.env.SHEET_PUB_ID.trim();
  try {
    const cfg = JSON.parse(await readFile(new URL('sheet.config.json', root), 'utf8'));
    return (cfg.publishId || '').trim();
  } catch {
    return '';
  }
}

async function exists(url) {
  try { await access(url); return true; } catch { return false; }
}

const id = await publishId();
await mkdir(dataDir, { recursive: true });

let failed = 0;
for (const [tab, gid] of Object.entries(TABS)) {
  const file = new URL(`${tab}.csv`, dataDir);
  if (!id) {
    console.warn(`[data] No publish ID set; keeping saved ${tab}.csv`);
    if (!(await exists(file))) failed++;
    continue;
  }
  // The timestamp asks Google for a fresh copy instead of a cached one that can be minutes old.
  const url = `https://docs.google.com/spreadsheets/d/e/${id}/pub?gid=${gid}&single=true&output=csv&t=${Date.now()}`;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // Google sends CRLF line endings; store LF so a rerun only shows real data changes.
    const text = (await res.text()).replace(/\r\n?/g, '\n');
    if (text.trimStart().startsWith('<')) throw new Error('got a web page instead of CSV (is the sheet published?)');
    await writeFile(file, text);
    console.log(`[data] ${tab}: ${text.split('\n').length - 1} rows`);
  } catch (err) {
    console.warn(`[data] Could not download ${tab} (${err.message}); keeping saved copy`);
    if (!(await exists(file))) failed++;
  }
}

if (failed) {
  console.error(`[data] ${failed} tab(s) have no data at all. Publish the sheet and set SHEET_PUB_ID.`);
  process.exit(1);
}
