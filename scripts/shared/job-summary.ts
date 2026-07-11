import { appendFile } from 'node:fs/promises';

/**
 * Outcome of running one connector through a pipeline phase (`update` or
 * `normalize`). `skipped` only applies to `update` (missing token, see
 * `scripts/update.ts`) — `normalize` has no equivalent skip condition.
 */
export type RunStatus = 'success' | 'skipped' | 'failed';

export interface RunResult {
    service: string;
    status: RunStatus;
}

const STATUS_ICON: Record<RunStatus, string> = {
    success: '✅',
    skipped: '⏭️',
    failed: '❌',
};

/** Renders a per-connector run summary as a Markdown table for `appendJobSummary`. */
export function formatResultsTable(title: string, results: RunResult[]): string {
    const rows = results
        .map((result) => `| ${result.service} | ${STATUS_ICON[result.status]} ${result.status} |`)
        .join('\n');
    return `### ${title}\n\n| Connector | Status |\n| --- | --- |\n${rows}\n`;
}

/**
 * Appends Markdown to the current GitHub Actions job's step summary — the
 * report rendered directly on the workflow run page, above the raw logs.
 * A genuine no-op outside GitHub Actions (`GITHUB_STEP_SUMMARY` is a path
 * the runner sets up per-step; it's simply unset locally), so this is safe
 * to call unconditionally from `updateAll`/`normalizeAll`.
 */
export async function appendJobSummary(markdown: string): Promise<void> {
    const path = process.env.GITHUB_STEP_SUMMARY;
    if (!path) {
        return;
    }
    await appendFile(path, `${markdown}\n`);
}
