import { normalizeAll } from './normalize.ts';
import { updateAll } from './update.ts';

/**
 * The pipeline's single entry point — what main-pipeline.yml runs. Loads
 * secrets, then executes phase 1 (`updateAll`) and phase 2
 * (`normalizeAll`) in one process. Phase failures don't abort the
 * process mid-way: each phase records them via `process.exitCode = 1`
 * instead of throwing, so normalize still processes whatever raw data a
 * partially-failed update did fetch, while the CI job as a whole is
 * still reported red.
 *
 * Secrets arrive as one JSON blob in `SECRETS_CONTEXT` (the workflow
 * passes `toJSON(secrets)`) rather than as individually named env vars.
 * That keeps the workflow file connector-agnostic: wiring up a connector
 * with a new token means adding a repository secret in GitHub, not
 * editing the workflow. `loadSecretsContext` unpacks the blob into
 * `process.env`, which is where connectors already look for their tokens
 * (see `updateAll`).
 */
function loadSecretsContext(): void {
    const raw = process.env.SECRETS_CONTEXT;
    if (!raw) {
        // Local run — tokens come from the ambient environment as-is.
        return;
    }

    let secrets: Record<string, string>;
    try {
        secrets = JSON.parse(raw);
    } catch (error) {
        // A malformed blob would otherwise make every connector "skip"
        // (token looks missing) and the run report green while doing
        // nothing — fail loudly instead.
        throw new Error('SECRETS_CONTEXT is set but is not valid JSON', { cause: error });
    }

    for (const [name, value] of Object.entries(secrets)) {
        // Never clobber a variable that's already set: an explicitly
        // provided env var should win over the blob.
        process.env[name] ??= value;
    }
}

loadSecretsContext();
await updateAll();
await normalizeAll();
