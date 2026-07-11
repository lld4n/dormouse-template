# scripts/

Data pipeline that pulls listening/activity history from external services
("connectors"), archives it verbatim, and normalizes it into a
deduplicated, per-entity dataset under `data/`. Runs on Bun (uses `Bun.file`
/ `Bun.write` throughout — not portable to plain Node without adaptation).

This file is the map; the "why" behind any specific piece of logic lives
in a JSDoc comment on that piece of code, not duplicated here.

## Two-phase pipeline

```
external API  --update-->  raw/<service>/<YYYY-MM-DD>.json  --normalize-->  data/<service>/...
                (fetch)              (immutable archive)         (dedup + model)
```

- **`update`** (entry: [`update.ts`](update.ts) -> `updateAll`): for each
  registered connector, fetch fresh data from its external API and archive
  it as-is via [`shared/save-snapshot.ts`](shared/save-snapshot.ts). Never
  touches `data/`.
- **`normalize`** (entry: [`normalize.ts`](normalize.ts) -> `normalizeAll`):
  for each connector, read whatever `raw/` snapshots haven't been processed
  yet, transform them into that connector's entity models, and merge the
  result into `data/`. Idempotent and incremental — each connector tracks
  its own "already processed up to here" cursor (see
  `yandex-music/normalize/index.ts`'s `meta.json` for the pattern) so
  re-running with no new raw snapshots is a cheap no-op.

The two phases are independent and can run on different schedules — `raw/`
is the durable handoff point between them, and is never rewritten by
`normalize` (so it doubles as full replay history if normalization logic
changes later).

Both entry points iterate every connector and keep going if one fails —
each failure is logged as an `error` rather than thrown immediately, so one
broken/rate-limited API doesn't block the others. The process as a whole
still fails, though: see "Logging & CI" below.

Both `update.ts` and `normalize.ts` are directly runnable
(`bun run scripts/update.ts` / `bun run scripts/normalize.ts`, or
`bun run update` / `bun run normalize` via the `package.json` scripts) as
well as importable — each guards its top-level call with
`if (import.meta.main)`.

## Directory structure

```
scripts/
  update.ts              Phase 1 orchestrator (updateAll)
  normalize.ts            Phase 2 orchestrator (normalizeAll)
  connectors/
    types.ts              The `Connector` contract every connector implements
    registry.ts            CONNECTORS array — the only place connectors get wired in
    <service>/             One folder per connector, e.g. yandex-music/
      index.ts              Exports the `Connector` object
      update.ts              Fetch + saveSnapshot
      raw-types.ts            Types mirroring the external API's raw response shape
      models/                 Normalized entity types (what ends up in data/)
      normalize/               raw -> models transform + persistence orchestration
  shared/
    save-snapshot.ts        Writes raw/<service>/<date>.json
    snapshot.ts               appendSnapshot: dedup rule for entity history arrays
    snapshot-store.ts          SnapshotStore<TRaw, TEntity, TSnapshot>: generic
                                 per-entity-type persistence engine built on appendSnapshot
    logger.ts                  CI-aware structured logger (GitHub Actions annotations
                                 + groups locally degrade to plain console output)
    job-summary.ts              Per-connector run-status table appended to the
                                 GitHub Actions job summary
```

## Logging & CI

Every log call goes through [`shared/logger.ts`](shared/logger.ts)'s
`Logger` — never call `console.*` directly in new pipeline code. Use
`logger.child(<service>)` at the top of a connector module to get a
logger that tags its output, and pick the right level:

| Level    | Use for                                                | In GitHub Actions renders as                      |
| -------- | ------------------------------------------------------ | ------------------------------------------------- |
| `debug`  | Verbose detail, off by default                         | `::debug::` (hidden unless step-debug is enabled) |
| `info`   | Routine progress                                       | plain log line                                    |
| `notice` | A highlight worth surfacing (run summary, skip reason) | `::notice::` annotation                           |
| `warn`   | Questionable but non-fatal                             | `::warning::` annotation                          |
| `error`  | A failure                                              | `::error::` annotation                            |

Wrap a connector's per-run work in `logger.group(title, fn)` so its output
collapses into a foldable section in the Actions log viewer (locally, this
is just a `=== title ===` separator — there's nothing to fold).

`updateAll`/`normalizeAll` (`update.ts`/`normalize.ts`) build on this:
they run each connector inside a group, and — critically for CI — track
which connectors failed and set `process.exitCode = 1` if any did. A
per-connector status table (success/skipped/failed) is also written to
`GITHUB_STEP_SUMMARY` via [`shared/job-summary.ts`](shared/job-summary.ts),
so a run's outcome is visible on the workflow run page without opening
logs at all. Without this, a broken connector would just log an error line
buried in the output while the job itself still reported success — the
whole point of leveling up logging for CI is that failures can't hide.

## The scheduled workflow

[`.github/workflows/data-pipeline.yml`](../.github/workflows/data-pipeline.yml)
runs `bun run update` then `bun run normalize` on a cron schedule (and via
manual `workflow_dispatch`), then commits any resulting `raw/`/`data/`
changes back to the repo.

It's intentionally inert in this repo — the job is guarded by
`if: ${{ !github.event.repository.is_template }}`, which is only `true`
for a repo with GitHub's own "Template repository" setting enabled
(Settings -> General), i.e. this repo. Any repo created via "Use this
template" starts with that setting off, so the pipeline activates there
with no edits to the workflow file. See the comment header in the
workflow file for the full reasoning.

Two one-time manual steps this can't automate away:

- **This repo**: "Template repository" must actually be checked in
  Settings -> General for the guard above to hold — verify it's on here.
- **Every generated repo**: add a `YANDEX_MUSIC_TOKEN` repository secret
  (Settings -> Secrets and variables -> Actions). GitHub never copies
  secrets from a template. Until it's added, `update` just skips that
  connector (see `updateAll`'s missing-token handling) rather than
  failing the run.

## Adding a new connector

See the full checklist in the `Connector` JSDoc in
[`connectors/types.ts`](connectors/types.ts). Short version: add a
`ConnectorService` value, build a `<service>/` folder mirroring
`yandex-music/`'s shape, export a `Connector` object from its `index.ts`,
and add that object to `CONNECTORS` in
[`connectors/registry.ts`](connectors/registry.ts). Nothing in
`update.ts`/`normalize.ts` needs to change.

## Adding a new normalized entity type within a connector

If a connector's raw data has entities that accumulate revisable metadata
over time (tracks, artists, albums, chart ranks, ...), model them as a
[`SnapshotStore`](shared/snapshot-store.ts) subclass — see its JSDoc for
the full "what it gives you for free" / "what you implement" breakdown and
a worked example. If the entity is instead an immutable point-in-time
event (like listening-history items), it likely doesn't need
`SnapshotStore` at all — see `yandex-music/normalize/history.ts` for that
alternative pattern (merge-by-key into time-bucketed files, no per-id
snapshots).

## Key invariants worth knowing before changing anything here

- **`raw/` is append-only and never mutated by `normalize`.** Treat it as
  the source of truth; `data/` is a derived/rebuildable cache of it.
- **Entity snapshots dedup by value, not by fetch.** `appendSnapshot`
  (`shared/snapshot.ts`) only appends a new snapshot if fields other than
  the timestamp changed — running `update` daily against an unchanged
  entity does not bloat its history.
- **Normalize cursors advance last.** Each connector's incremental-progress
  marker (e.g. `meta.json`) is written only after all its data is
  successfully saved, so a crash mid-run just means safely reprocessing
  the same raw files next time, not a corrupted/skipped state.
