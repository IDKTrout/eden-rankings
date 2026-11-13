# Event Rankings

The website at [event-rankings.edenafk.com](https://event-rankings.edenafk.com): AbEx guild damage and Temporal Rift player floors, season by season, with pages for every guild, player, group and region.

All rankings are gathered by Tunarda (id: 44843); each season credits its compilers.

## Where the data lives

Since 2026-11-12 the data lives in a **Supabase database** (project *Event Rankings*, in the Eden organization) and is edited in the **admin area** at [/admin/](https://event-rankings.edenafk.com/admin/). The Google Sheet **AbEx Guild Rankings** is no longer read by the site; it is kept as an archive of how the data started.

| Table | One row per | Notes |
|---|---|---|
| `events` | event (AbEx, AbEx Test, Temporal Rift, Alna) | whether it ranks guilds or players, its score label, whether it has brackets or times, and `show_on_site`. New events (added on the admin's Events tab) stay off the site until it has a page layout for them; only admins can switch that on |
| `seasons` | ranking season | `sort_order` (higher = more recent), `end_date`, `max_score` (AbEx max damage), `compiled_by` and `thanks` for credits |
| `results` | one line of one ranking, for every event | `listed_name` exactly as in the image; `guild_id` and/or `player_id`; `bracket`, `rank`, `score`, `score_rounded` (like 13M), `time_seconds`, `server` (player events) or `region` (guild events); event-specific fields such as leader and essence in `extra` |
| `guilds` | guild | `id` is the game's guild ID (or `g###` until known); `region`, `group_id`, `inactive` (guilds are placed by region, never by server) |
| `guild_names` | spelling of a guild name seen in a ranking | maps each spelling to one guild, which is how renamed guilds are combined |
| `players` | player | `id` is the game's player ID; `inactive` |
| `groups` | group of guilds (Eden, Sin, FU, Elements, Storm) | `short_name` is the tag text, `color` its hex color, `sort_order` the display order |
| `regions` | region | `first_server` to `last_server` (blank until known) |
| `editors` | person who can edit | `admin` (add, fix, delete, manage editors) or `helper` (add and fix only) |
| `change_log` | change | every add, fix and delete, with who made it and the old and new values |

The schema is in `supabase/migrations/`. Row-level security lets anyone read, editors add and fix, and only admins delete. Guilds are matched by guild ID and players by player ID, so name changes keep one history; tables add "listed as" with the name used that season.

## Adding a season

Use the admin area: **Seasons → New season**, then **Results → Add results by pasting**. The [helper guide](guides/helper-guide.png) and [admin guide](guides/admin-guide.png) walk through it (rebuild them with `npm run guides` after changing `scripts/make-guides.mjs`).

For AbEx, guilds at the season's max damage finished and their time is their finish time; every other guild's time is their last attack.

## Alna

**Alna** is a guild event played in brackets and scored in points. On the site:
- a guild is shown if it finished **top 3 in its bracket**, or if it is in the season's **overall top 100 and has more than 1,000,000 points**;
- the overall rank is worked out when the data is downloaded, breaking equal-point ties using each bracket's own order;
- scores the game rounded (`score_rounded`, such as 13M) are shown with ≈;
- guild pages show Alna results with gold, silver and bronze for a top-3 finish in the guild's bracket, and Alna counts in group standings;
- Alna is not featured on the home page or in region standings.

## How the site is built

A static [Astro](https://astro.build) site, deployed by Cloudflare Workers Builds from the `main` branch.

- `.github/workflows/refresh-data.yml` downloads the database every 15 minutes and commits any change to `src/data/`, which makes Cloudflare rebuild the site. To update right away, open the repository's **Actions** tab, pick **Refresh rankings data** and press **Run workflow**.
- `scripts/fetch-data.mjs` does the download with the public read-only key and writes one CSV per former sheet tab, so the pages read the same shape as before. Cloudflare builds from the copy saved in the repository, so what is committed is exactly what goes live. (`scripts/fetch-sheet.mjs` still downloads the old sheet, for reference.)
- `src/admin/` and `src/pages/admin.astro` are the admin area; it talks to the database directly from the browser.
- `src/lib/data.ts` turns the CSVs into seasons, rankings, guilds, players, groups and regions; `src/lib/groups.ts` and `src/lib/regions.ts` work out standings.
- `src/pages/` holds the pages: home, `/seasons/`, `/season/<season_id>/`, `/guilds/`, `/guild/<guild_id>/`, `/players/`, `/player/<player_id>/`, `/groups/`, `/group/<group_id>/`, `/regions/`, `/region/<region>/`, `/search/` and `/sitemap.xml`.

## Working on it locally

```bash
npm install
npm run data         # download the latest data from the database
npm run dev          # preview at http://localhost:4321 (admin at /admin/)
npm run build        # build into dist/ from the saved data in src/data/
npm run build:fresh  # download the latest data, then build
```

## Cloudflare settings

| Setting | Value |
|---|---|
| Project | `eden-rankings` (Workers Builds) |
| Branch | `main` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | 22 (from `.nvmrc`) |
| Custom domain | `event-rankings.edenafk.com` |
