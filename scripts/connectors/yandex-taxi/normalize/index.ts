import type { RawOrderHistory } from '../raw-types.ts';
import { readdir } from 'node:fs/promises';
import { logger } from '../../../shared/logger.ts';
import { writeRideIndex } from './ride-index.ts';
import { buildRide, RideStore } from './rides.ts';

const log = logger.child('yandex-taxi');

const RAW_DIR = 'raw/yandex-taxi';
/**
 * Incremental-processing cursor: `{ lastProcessed: <newest raw snapshot
 * filename already normalized> }`. Raw snapshot filenames are
 * `<YYYY-MM-DD-HH-mm>.json` (the export's download time — this connector
 * has no scheduled `update()`, see `update.ts`, so unlike `yandex-music`
 * more than one export can land on the same calendar day and needs the
 * time component to sort correctly), so their lexical order is also their
 * chronological order.
 */
const META_FILE = 'data/yandex-taxi/meta.json';

/** Reads the incremental cursor; no cursor means process every raw snapshot. */
async function readLastProcessed(): Promise<string | null> {
    const file = Bun.file(META_FILE);
    if (!(await file.exists())) {
        return null;
    }
    const meta: { lastProcessed: string } = await file.json();
    return meta.lastProcessed;
}

/**
 * Lists `raw/yandex-taxi/*.json` snapshot files, oldest first (by
 * filename-as-timestamp). Missing directory reads as empty rather than
 * throwing — see `yandex-music/normalize/index.ts`'s `listRawSnapshots`
 * for why (`raw/` is never shipped by the template, only created on first
 * write).
 */
async function listRawSnapshots(): Promise<string[]> {
    let entries: string[];
    try {
        entries = await readdir(RAW_DIR);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return [];
        }
        throw error;
    }

    return entries.filter((f) => f.endsWith('.json')).sort();
}

/**
 * `Connector.normalize` implementation for Yandex Taxi (see `types.ts`).
 * Orchestrates the raw -> normalized transform:
 *
 * 1. Reads the `lastProcessed` filename cursor and lists newer
 *    `raw/yandex-taxi/*.json` snapshots in chronological order.
 * 2. Replays those files through one `RideStore` shared across the whole
 *    run, in filename order — since each snapshot is a full re-export
 *    (not a delta) and `RideStore` overwrites on any difference, a later
 *    file's view of a given `order_id` always wins over an earlier one in
 *    the same run, matching the "newer wins" rule `RideStore` also applies
 *    against what's already on disk from previous runs.
 * 3. Saves the store, rebuilds `data/yandex-taxi/index/rides.json` from
 *    the full `rides/` directory, then advances the cursor.
 *
 * If step 3's `META_FILE` write never runs — e.g. a crash after `save()`
 * — the next run safely reprocesses the same files; `RideStore`'s
 * dequal-based skip makes that a no-op for rides that didn't actually
 * change.
 */
export async function normalizeYandexTaxi(): Promise<void> {
    const lastProcessed = await readLastProcessed();

    const allFiles = await listRawSnapshots();
    const newFiles = allFiles.filter((name) => lastProcessed === null || name > lastProcessed);

    if (newFiles.length === 0) {
        log.info('Nothing new to normalize.');
        return;
    }

    const rides = new RideStore('data/yandex-taxi/rides');

    for (const name of newFiles) {
        const raw: RawOrderHistory = await Bun.file(`${RAW_DIR}/${name}`).json();
        for (const order of raw) {
            await rides.process(buildRide(order));
        }
    }

    await rides.save();
    const indexed = await writeRideIndex();

    // Cursor advance is intentionally last: if anything above throws, this
    // line never runs and the next invocation safely reprocesses the same
    // files (see the crash-safety note on `normalizeYandexTaxi` above).
    await Bun.write(META_FILE, `${JSON.stringify({ lastProcessed: newFiles.at(-1) })}\n`);

    log.notice('Processed snapshot(s)', {
        snapshots: newFiles.length,
        rides: rides.stats.total,
        created: rides.stats.created,
        updated: rides.stats.updated,
        indexed,
    });
}
