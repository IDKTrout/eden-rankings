# Eden Rankings

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

## Status

Planning. The site's framework, hosting and domain setup are still to be decided.
