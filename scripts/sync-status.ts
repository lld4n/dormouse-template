/**
 * Writes `data/extra/template-sync-status.json` — a machine-readable
 * record of this repo's template-sync state, maintained by
 * `.github/workflows/sync-template.yml`. It exists so a repo's sync
 * status ("is it in sync, or does it have an unresolved merge conflict
 * waiting on a human?") can be read with a single file fetch (e.g. the
 * GitHub contents API, or just `git show origin/<default>:data/extra/template-sync-status.json`)
 * instead of having to query the Issues API and match on title text. The
 * GitHub issue that `sync-template.yml` opens on conflict is still the
 * human-facing notification; this file is the machine-facing one.
 *
 * Lives under `data/extra/` rather than `.github/` because it's generated
 * repo state in the same sense as `data/<connector>/...` is — see
 * `scripts/README.md` — not CI configuration. `extra/` (rather than a
 * connector name) namespaces it as pipeline-infra data rather than
 * anything fetched from a connector's API.
 *
 * Not part of the update/normalize pipeline itself — invoked directly by
 * the sync-template workflow as `bun run scripts/sync-status.ts <mode> [flags]`.
 */

const STATUS_FILE = 'data/extra/template-sync-status.json';

interface CleanStatus {
    status: 'clean';
    checkedAt: string;
    templateUrl: string;
    templateCommit?: string;
}

interface ConflictStatus {
    status: 'conflict';
    checkedAt: string;
    templateUrl: string;
    branch: string;
    conflictFiles: string[];
    issue: number;
}

export type SyncStatus = CleanStatus | ConflictStatus;

/** Overwrites `data/extra/template-sync-status.json` with `status` — this is the entire on-disk contract, one file, always fully replaced (no merge/append semantics, unlike the entity snapshot stores in `shared/snapshot-store.ts`). */
export async function writeSyncStatus(status: SyncStatus): Promise<void> {
    await Bun.write(STATUS_FILE, `${JSON.stringify(status, null, 2)}\n`);
}

/** Parses `--key=value` pairs from CLI args into a lookup object; bare flags and `--key value` (space-separated) are not supported, only `=`-joined. */
function parseFlags(argv: string[]): Record<string, string> {
    const flags: Record<string, string> = {};
    for (const arg of argv) {
        const match = /^--([^=]+)=(.*)$/.exec(arg);
        if (match) {
            flags[match[1]] = match[2];
        }
    }
    return flags;
}

function requireFlag(flags: Record<string, string>, name: string): string {
    const value = flags[name];
    if (!value) {
        throw new Error(`Missing required --${name} flag.`);
    }
    return value;
}

async function main(): Promise<void> {
    const [mode, ...rest] = process.argv.slice(2);
    const flags = parseFlags(rest);
    const checkedAt = new Date().toISOString();
    const templateUrl = requireFlag(flags, 'template-url');

    if (mode === 'clean') {
        await writeSyncStatus({
            status: 'clean',
            checkedAt,
            templateUrl,
            ...(flags['template-commit'] ? { templateCommit: flags['template-commit'] } : {}),
        });
        return;
    }

    if (mode === 'conflict') {
        const branch = requireFlag(flags, 'branch');
        const issue = requireFlag(flags, 'issue');
        const files = requireFlag(flags, 'files');

        await writeSyncStatus({
            status: 'conflict',
            checkedAt,
            templateUrl,
            branch,
            conflictFiles: files.split(',').filter(Boolean),
            issue: Number(issue),
        });
        return;
    }

    throw new Error(`Unknown mode "${mode}" — expected "clean" or "conflict".`);
}

if (import.meta.main) {
    await main();
}
