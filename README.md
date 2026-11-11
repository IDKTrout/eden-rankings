# Event Rankings

A website for Eden ranking seasons: AbEx guild damage and Temporal Rift player floors, with pages for every guild and player across seasons.

## Where the data lives

All rankings are entered in the Google Sheet **AbEx Guild Rankings**. The site reads from it, so a new season appears on the site once its rows are in the sheet.

| Tab | One row per | Key |
|---|---|---|
| `seasons` | ranking season | `season_id` (for example `abex-s4`, `rift-s2`) |
| `abex_rankings` | guild per AbEx season | `season_id` + `guild_name` |
| `rift_rankings` | player per Temporal Rift season | `season_id` + `player_id` |
| `guilds` | guild | `guild_id` (the game's guild ID, or `g###` until it's known) |
| `guild_names` | spelling of a guild name seen in a ranking | `guild_name` → `guild_id` |
| `players` | player | `player_id` (the game's player ID) |
| `fields` | column | describes every column above |

Renamed guilds are combined through `guild_names`: every spelling points at one `guild_id`. Players are matched by `player_id`, so name changes combine automatically.

## Adding a season

1. Add the ranking rows to `abex_rankings` or `rift_rankings` with a new `season_id`.
2. Add any new guild spelling to `guild_names`, and any new guild to `guilds`.
3. Add any new player ID to `players`.
4. Add a row to `seasons`.

The `seasons` tab lists events in the order they took place, oldest first, so add each new season at the bottom. The site uses that order everywhere; the last AbEx and Temporal Rift rows are the ones featured on the home page.

For AbEx seasons, `max_damage_m` in the `seasons` tab is the most damage a guild could deal. Guilds at that number finished, and their time is their finish time. Every other guild's time is their last attack.

## How the site is built

The site is a static [Astro](https://astro.build) site, hosted on Cloudflare Pages at [event-rankings.edenafk.com](https://event-rankings.edenafk.com).

- `scripts/fetch-data.mjs` downloads each tab of the published sheet as CSV into `src/data/`. The publish ID is in `sheet.config.json` (or the `SHEET_PUB_ID` environment variable). If a download fails, the copy already in `src/data/` is used.
- `src/lib/data.ts` turns those CSVs into seasons, rankings, guilds and players.
- `src/pages/` holds the pages: home, `/seasons/`, `/season/<season_id>/`, `/guilds/`, `/guild/<guild_id>/`, `/players/`, `/player/<player_id>/` and `/search/`.
- `.github/workflows/refresh-data.yml` downloads the sheet every 3 hours and commits any change to `src/data/`, which makes Cloudflare rebuild the site. To update right away, open the repository's **Actions** tab, pick **Refresh sheet data** and press **Run workflow**.
- `apps-script/UpdateWebsite.gs` is an optional "Eden website" menu for the sheet. It needs a Cloudflare deploy hook URL, so it's only useful if the Cloudflare project offers one.

## Working on it locally

```bash
npm install
npm run data      # download the latest sheet data
npm run dev       # preview at http://localhost:4321
npm run build     # download data and build into dist/
```

## Cloudflare settings

The site is deployed by Cloudflare Workers Builds from the `main` branch (project `eden-rankings`).

| Setting | Value |
|---|---|
| Framework preset | Astro |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | 22 (from `.nvmrc`) |
