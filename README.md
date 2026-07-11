# dormouse 🐭

A personal-data archival template: periodically pulls your activity
history from external services (currently Yandex Music listening
history) and keeps a deduplicated, versioned record of it in this
repository via scheduled GitHub Actions — plus a [Next.js](https://nextjs.org)
app for building a UI on top of the archived data.

Click "Use this template" to get your own copy. Everything below runs on
[Bun](https://bun.sh).

## How it works

Two GitHub Actions workflows, both inert in the template itself and
active automatically in any repo generated from it (via the
`is_template` guard — see the header comments in the workflow files):

- [`main-pipeline.yml`](.github/workflows/main-pipeline.yml) — runs the
  data pipeline (`bun run scripts/main.ts`) on a daily schedule and
  commits the resulting `raw/`/`data/` changes. Secrets are passed
  wholesale as `SECRETS_CONTEXT: ${{ toJSON(secrets) }}`, so wiring up a
  new connector token never requires editing the workflow.
- [`sync-template.yml`](.github/workflows/sync-template.yml) — weekly
  merges this template's latest changes into the generated repo, so
  improvements here keep flowing downstream. Clean merges go straight to
  the default branch; conflicts get a `template-sync` branch and an
  issue. `.github/workflows/` is deliberately excluded from syncing.

See [`scripts/README.md`](scripts/README.md) for the full pipeline
architecture (update/normalize phases, connectors, logging, invariants)
and how to add another connector.

## Setting up a generated repo

1. Add connector secrets (currently `YANDEX_MUSIC_TOKEN`) in
   Settings -> Secrets and variables -> Actions. GitHub never copies
   secrets from a template; until a secret is added, the pipeline just
   skips that connector.
2. That's it — both workflows are already active. Trigger them manually
   from the Actions tab for a first run instead of waiting for the cron.

## Development

```bash
bun install
bun dev          # Next.js dev server at http://localhost:3000
bun run lint     # eslint + prettier + stylelint
bun run lint:fix
```

The data pipeline can be run locally too — tokens are read from the
environment when `SECRETS_CONTEXT` isn't set:

```bash
YANDEX_MUSIC_TOKEN=... bun run scripts/main.ts
```

## Next.js app

The app lives in [`src/app/`](src/app) and is currently a blank canvas
(`page.tsx` renders nothing) — a place to build views over the archived
data in `data/`.
