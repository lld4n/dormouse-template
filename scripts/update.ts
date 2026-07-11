import type { RunResult } from './shared/job-summary.ts';
import { CONNECTORS } from './connectors/registry.ts';
import { appendJobSummary, formatResultsTable } from './shared/job-summary.ts';
import { logger } from './shared/logger.ts';

/**
 * Phase 1 of the pipeline: for every registered connector, resolves its
 * required auth token from the environment and calls `update()` to fetch
 * fresh data from the external API into an immutable snapshot under
 * `raw/<service>/`. Does not touch `data/` — see `normalizeAll` for that.
 *
 * Connectors are independent and best-effort:
 *   - Missing env var -> connector is skipped (logged as `notice`, not an
 *     error). Lets this run in environments that only have credentials
 *     for some services.
 *   - Thrown error during `update()` -> caught and logged as `error` per
 *     connector so one API outage doesn't prevent the others from updating.
 *
 * Each connector's `update()` call runs inside `logger.group`, so in
 * GitHub Actions its output collapses into its own foldable log section
 * titled with the service name.
 *
 * Unlike a bare try/catch-and-continue, a failure here is NOT silently
 * absorbed at the process level: `process.exitCode` is set to `1` if any
 * connector failed, so a CI job invoking this fails visibly (red ✗)
 * instead of reporting success while having actually skipped data for a
 * broken connector. A run-status table is also appended to the GitHub
 * Actions job summary via `appendJobSummary`, so failures/skips are
 * visible on the run page without opening the raw logs.
 */
export async function updateAll(): Promise<void> {
    const results: RunResult[] = [];

    for (const connector of CONNECTORS) {
        const token = process.env[connector.token];
        const log = logger.child(connector.service);

        if (!token) {
            log.notice(`Skipped: ${connector.token} is not set.`);
            results.push({ service: connector.service, status: 'skipped' });
            continue;
        }

        try {
            await logger.group(connector.service, () => connector.update(token));
            results.push({ service: connector.service, status: 'success' });
        } catch (error) {
            log.error('Update failed', error);
            results.push({ service: connector.service, status: 'failed' });
        }
    }

    await appendJobSummary(formatResultsTable('Update', results));

    if (results.some((result) => result.status === 'failed')) {
        process.exitCode = 1;
    }
}

if (import.meta.main) {
    await updateAll();
}
