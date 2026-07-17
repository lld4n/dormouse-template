/**
 * One entry per data source the pipeline knows how to pull from. The string
 * value doubles as:
 *   - the `raw/<value>/` snapshot directory name (see `saveSnapshot`)
 *   - the `data/<value>/` normalized-output directory name
 * Renaming a value is a breaking change for any data already on disk.
 */
export enum ConnectorService {
    YANDEX_MUSIC = 'yandex-music',
    YANDEX_TAXI = 'yandex-taxi',
}

/**
 * The contract every connector implements to plug into the two pipeline
 * phases run by `scripts/update.ts` and `scripts/normalize.ts`.
 *
 * To add a new connector:
 *   1. Add a value to `ConnectorService` above.
 *   2. Create `scripts/connectors/<service>/` with an `update.ts` (fetch +
 *      `saveSnapshot`) and a `normalize.ts`/`normalize/index.ts` (raw ->
 *      `data/` transform), mirroring the `yandex-music/` folder.
 *   3. Export a `Connector` object (see `yandex-music/index.ts`) and add it
 *      to the `CONNECTORS` array in `registry.ts`. That's the only place
 *      `scripts/update.ts`/`scripts/normalize.ts` need to know about it.
 *   4. In each repo that should run it, add a repository secret named
 *      exactly like the connector's `token` field (Settings -> Secrets and
 *      variables -> Actions). Nothing else: main-pipeline.yml forwards ALL
 *      repository secrets via `SECRETS_CONTEXT`, so the workflow file
 *      doesn't need editing.
 */
export interface Connector {
    /** Identifies the connector and its on-disk directories; must be a `ConnectorService` value. */
    service: ConnectorService;
    /**
     * Name of the environment variable holding this connector's auth token
     * (not the token value itself). `update.ts` reads `process.env[token]`
     * and skips the connector with a log line if it's unset, so pipelines
     * without a given service's credentials configured don't hard-fail.
     */
    token: string;
    /**
     * Fetches fresh data from the external API and writes it as an
     * immutable snapshot via `saveSnapshot`. Must not touch `data/` —
     * that's `normalize`'s job. Receives the resolved token value (not the
     * env var name).
     */
    update: (token: string) => Promise<void>;
    /**
     * Reads unprocessed files from `raw/<service>/`, transforms them into
     * the connector's normalized entity models, and merges the result into
     * `data/<service>/`. Must be idempotent/incremental — re-running it
     * with no new raw snapshots should be a no-op (see the `meta.json`
     * cursor pattern in `yandex-music/normalize/index.ts`).
     */
    normalize: () => Promise<void>;
}
