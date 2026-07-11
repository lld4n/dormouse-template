import type { RunResult } from './shared/job-summary.ts';
import { CONNECTORS } from './connectors/registry.ts';
import { appendJobSummary, formatResultsTable } from './shared/job-summary.ts';
import { logger } from './shared/logger.ts';

/**
 * Phase 2 of the pipeline: turns each connector's raw snapshots (written by
 * `updateAll` into `raw/<service>/`) into deduplicated, per-entity history
 * under `data/<service>/`. Safe to run on a schedule independent of
 * `updateAll` — each connector's `normalize()` tracks its own progress
 * cursor and is a no-op if there's nothing new.
 *
 * One connector throwing does not stop the others: errors are caught and
 * logged (as `error`) per-connector so a single broken/incompatible raw
 * snapshot can't block normalization for the rest of the services. Each
 * connector's `normalize()` call runs inside `logger.group`, so in GitHub
 * Actions its output collapses into its own foldable log section titled
 * with the service name.
 *
 * As with `updateAll`, a per-connector failure still fails the process
 * overall: `process.exitCode` is set to `1` if any connector failed, so
 * CI surfaces it instead of reporting a silently-partial success. A
 * run-status table is also appended to the GitHub Actions job summary via
 * `appendJobSummary`.
 */
export async function normalizeAll(): Promise<void> {
    const results: RunResult[] = [];

    for (const connector of CONNECTORS) {
        const log = logger.child(connector.service);

        try {
            await logger.group(connector.service, () => connector.normalize());
            results.push({ service: connector.service, status: 'success' });
        } catch (error) {
            log.error('Normalize failed', error);
            results.push({ service: connector.service, status: 'failed' });
        }
    }

    await appendJobSummary(formatResultsTable('Normalize', results));

    if (results.some((result) => result.status === 'failed')) {
        process.exitCode = 1;
    }
}

if (import.meta.main) {
    await normalizeAll();
}
