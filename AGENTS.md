<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Design language

Terminal minimalism, reference: npmx.dev (open source, Nuxt — take the aesthetic, not the code). Geist + Geist Mono via `next/font`, oklch design tokens in `src/app/globals.scss` (`--bg`/`--fg`/`--border`/`--accent`), SCSS modules, no Tailwind. The npmx name must not appear in user-facing UI or code — this file is the only place it belongs.

## Derived data for rendering

Do not make request-time pages scan large collections of entity JSON files. When a view needs aggregate or searchable data, it may be precomputed by connector normalization into a compact, versioned derived file. Every such optimization must document why it is needed and include a migration path: existing generated repositories must build the new file from their archived data, while new repositories must create it from their first normalization run. Agree the migration and rollout sequence before changing a normalized-data format.
