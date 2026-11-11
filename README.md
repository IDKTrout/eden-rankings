# Event Rankings

The website at [event-rankings.edenafk.com](https://event-rankings.edenafk.com): AbEx guild damage and Temporal Rift player floors, season by season, with pages for every guild, player, group and region.

All rankings are gathered by Tunarda (id: 44843); each season credits its compilers.

## Where the data lives

Everything is entered in the Google Sheet **AbEx Guild Rankings**. The site reads a published copy of it, so a change in the sheet appears on the site after the next refresh (see below).

| Tab | One row per | Notes |
|---|---|---|
| `abex_rankings` | guild per AbEx season | `guild_name` exactly as in the image; `guild_id` and `current_guild_name` are looked up |
| `rift_rankings` | player per Temporal Rift season | `player_id` from the image; `guild_id` and `current_guild_name` are looked up |
| `guilds` | guild | `guild_id` is the game's guild ID (or `g###` until known). Set `home_server`, `group_id` and `inactive` here; `region`, `names_seen` and the season counts are formulas |
| `groups` | group of guilds (Eden, Sin, FU, Elements, Storm) | `short_name` is the tag text, `color` its hex color |
| `regions` | region | `first_server` to `last_server`; a row turns red if it overlaps another |
| `guild_names` | spelling of a guild name seen in a ranking | maps each spelling to one `guild_id`, which is how renamed guilds are combined |
| `players` | player | `player_id` is the game's player ID; tick `inactive` for players who stopped |
| `seasons` | ranking season | oldest first; `end_date` (shown as "Ended …"), `max_damage_m` for AbEx, `compiled_by` and `thanks` for credits |
| `fields` | column | describes every column in every tab |
| `checks` | — | flags problems automatically; row 2 is green at 0 and red when something needs fixing |

Guilds are matched by `guild_id` and players by `player_id`, so name changes keep one history. Renaming a guild in the `guilds` tab renames it everywhere on the site; tables add "listed as" with the name used that season.

## Adding a season

1. Add a row to `seasons` at the bottom (events are listed in the order they took place) with its `end_date`. For AbEx, fill in `max_damage_m`.
2. Add the ranking rows to `abex_rankings` or `rift_rankings` with the new `season_id`, typing guild names exactly as they appear in the image.
3. Open the `checks` tab and fix anything it lists:
   - a new guild spelling: add it to `guild_names` (and the guild to `guilds` if it's new);
   - a new player ID: add it to `players`;
   - a server with no region: add the range to `regions`.
4. Run the refresh (below) or wait up to 3 hours.

For AbEx, guilds at the season's `max_damage_m` finished and their time is their finish time; every other guild's time is their last attack.

## Alna

**Alna** (`alna_rankings`, `alna_overall`) is a guild event played in brackets and scored in points. On the site:
- a guild is shown if it finished **top 3 in its bracket**, or if it is in the season's **overall top 100 and has more than 1,000,000 points**;
- the overall ranking uses `overall_rank`, which breaks equal-point ties using each bracket's own order;
- scores the game rounded (`points_rounded`, such as 13M) are shown with ≈;
- guild pages show Alna results with gold, silver and bronze for a top-3 finish in the guild's bracket, and Alna counts in group standings;
- Alna is not featured on the home page or in region standings.

## How the site is built

A static [Astro](https://astro.build) site, deployed by Cloudflare Workers Builds from the `main` branch.

- `.github/workflows/refresh-data.yml` downloads the published sheet every 3 hours and commits any change to `src/data/`, which makes Cloudflare rebuild the site. To update right away, open the repository's **Actions** tab, pick **Refresh sheet data** and press **Run workflow**.
- `scripts/fetch-data.mjs` does the download. The publish ID is in `sheet.config.json` (or the `SHEET_PUB_ID` environment variable). Cloudflare builds from the copy saved in the repository, so what is committed is exactly what goes live.
- `src/lib/data.ts` turns the CSVs into seasons, rankings, guilds, players, groups and regions; `src/lib/groups.ts` and `src/lib/regions.ts` work out standings.
- `src/pages/` holds the pages: home, `/seasons/`, `/season/<season_id>/`, `/guilds/`, `/guild/<guild_id>/`, `/players/`, `/player/<player_id>/`, `/groups/`, `/group/<group_id>/`, `/regions/`, `/region/<region>/`, `/search/` and `/sitemap.xml`.

## Working on it locally

```bash
npm install
npm run data         # download the latest sheet data
npm run dev          # preview at http://localhost:4321
npm run build        # build into dist/ from the saved data in src/data/
npm run build:fresh  # download the latest sheet data, then build
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
