/**
 * CI-aware structured logger for the update/normalize pipeline (see
 * `scripts/README.md`). Two output modes, chosen automatically:
 *
 * - **GitHub Actions** (`GITHUB_ACTIONS=true`, set by the runner itself):
 *   emits GitHub's "workflow commands" — `::error::`, `::warning::`,
 *   `::notice::`, `::debug::`, `::group::`/`::endgroup::` — so errors and
 *   warnings surface as annotations on the run summary/PR checks instead
 *   of being buried in raw log text, and each connector's output collapses
 *   into its own foldable section.
 *   Reference: https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions
 * - **Local/anything else**: plain, human-readable console output with a
 *   level tag and optional scope prefix — no special escaping, no folding.
 *
 * Use `logger.child(name)` to get a logger that tags every line with a
 * scope (e.g. the connector's service name) instead of repeating it in
 * every call site — see `connectors/yandex-music/update.ts` for the
 * pattern.
 */

const isGithubActions = process.env.GITHUB_ACTIONS === 'true';

/**
 * Escapes text for safe use as a GitHub Actions workflow command's message
 * segment. Required because `%`, `\r`, `\n` are meaningful to the runner's
 * command parser — an unescaped newline in an error stack trace would
 * otherwise be read as the start of a new (non-command) log line rather
 * than part of this command's message.
 */
function escapeData(value: string): string {
    return value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
}

/** Structured key-value context appended to a log line, e.g. `{ snapshots: 3, artists: 12 }` -> `(snapshots=3, artists=12)`. */
export type LogFields = Record<string, string | number | boolean | undefined>;

function formatFields(fields?: LogFields): string {
    if (!fields) {
        return '';
    }
    const parts = Object.entries(fields)
        .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
        .map(([key, value]) => `${key}=${value}`);
    return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}

/** Renders an unknown thrown value as readable text — an `Error`'s stack trace when available, its message otherwise, or `String(error)` for non-Error throws. */
function formatError(error: unknown): string {
    if (error instanceof Error) {
        return error.stack ?? error.message;
    }
    return String(error);
}

export class Logger {
    constructor(private readonly scope?: string) {}

    /**
     * Returns a new `Logger` that prefixes every line with `name` (nested
     * under this logger's own scope, if any, as `parent:child`). Doesn't
     * mutate `this` — safe to create once per connector/module and reuse.
     */
    child(scope: string): Logger {
        return new Logger(this.scope ? `${this.scope}:${scope}` : scope);
    }

    /** Debug-only detail. In GitHub Actions this is invisible unless the run has step-debug logging enabled (`::debug::`); locally it always prints. */
    debug(message: string, fields?: LogFields): void {
        const content = this.render(message, fields);
        if (isGithubActions) {
            console.log(`::debug::${escapeData(content)}`);
        } else {
            console.debug(`[debug] ${content}`);
        }
    }

    /** Routine progress output. Always visible, never elevated to an annotation — use `notice` instead for anything worth surfacing in the CI run summary. */
    info(message: string, fields?: LogFields): void {
        console.log(this.render(message, fields));
    }

    /** Informational highlight worth surfacing outside the raw log (e.g. a per-connector run summary) without implying anything went wrong. Renders as a `::notice::` annotation in GitHub Actions. */
    notice(message: string, fields?: LogFields): void {
        const content = this.render(message, fields);
        console.log(isGithubActions ? `::notice::${escapeData(content)}` : `[notice] ${content}`);
    }

    /** Something questionable but non-fatal to the run (e.g. a connector skipped for missing config). Renders as a `::warning::` annotation in GitHub Actions. */
    warn(message: string, fields?: LogFields): void {
        const content = this.render(message, fields);
        if (isGithubActions) {
            console.log(`::warning::${escapeData(content)}`);
        } else {
            console.warn(`[warn] ${content}`);
        }
    }

    /** A failure. Renders as an `::error::` annotation in GitHub Actions, which is what makes failures visible on the run summary/PR checks — this alone does not fail the job/exit code; callers are responsible for that (see `updateAll`/`normalizeAll`). */
    error(message: string, error?: unknown, fields?: LogFields): void {
        const content = this.render(message, fields, error);
        if (isGithubActions) {
            console.log(`::error::${escapeData(content)}`);
        } else {
            console.error(`[error] ${content}`);
        }
    }

    /**
     * Runs `fn` inside a collapsible section in the GitHub Actions log
     * viewer (a plain `=== title ===` separator locally, where there's no
     * folding to fold into). The section is always closed — including when
     * `fn` throws — so one connector's failure never leaves the rest of
     * the run's log nested inside its group. The error itself is NOT
     * caught here; it propagates to the caller after the group is closed.
     */
    async group<T>(title: string, fn: () => Promise<T> | T): Promise<T> {
        const heading = this.render(title);
        if (isGithubActions) {
            console.log(`::group::${escapeData(heading)}`);
        } else {
            console.log(`\n=== ${heading} ===`);
        }
        try {
            return await fn();
        } finally {
            if (isGithubActions) {
                console.log('::endgroup::');
            }
        }
    }

    private render(message: string, fields?: LogFields, error?: unknown): string {
        const tag = this.scope ? `[${this.scope}] ` : '';
        const base = `${tag}${message}${formatFields(fields)}`;
        return error !== undefined ? `${base}\n${formatError(error)}` : base;
    }
}

/** Root logger, unscoped. Prefer `logger.child(<service>)` inside a connector rather than reusing this directly, so its output is identifiable when multiple connectors run in the same job. */
export const logger = new Logger();
