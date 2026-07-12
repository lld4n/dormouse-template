import type { HistoryItem } from '../models/history.ts';

import type { RawHistoryResponse } from '../raw-types.ts';
import { readdir } from 'node:fs/promises';
import { logger } from '../../../shared/logger.ts';
import { AlbumStore, collectAlbums } from './albums.ts';
import { ArtistStore, collectArtists } from './artists.ts';
import { ChartStore } from './charts.ts';
import { buildHistory, mergeHistory } from './history.ts';
import { writeTrackIndex } from './track-index.ts';
import { TrackStore } from './tracks.ts';

const log = logger.child('yandex-music');

const RAW_DIR = 'raw/yandex-music';
/**
 * Incremental-processing cursor: `{ lastProcessed: <newest raw snapshot
 * filename already normalized> }`. Raw snapshot filenames are ISO dates, so
 * their lexical order is also their chronological order. This makes
 * `normalizeYandexMusic`
 * idempotent and cheap to rerun on a schedule — without it, every run
 * would reprocess the entire `raw/` history from scratch.
 */
const META_FILE = 'data/yandex-music/meta.json';

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
 * Lists `raw/yandex-music/*.json` snapshot files, oldest first (by
 * filename-as-date — see `saveSnapshot`'s `<YYYY-MM-DD>.json` naming).
 *
 * `RAW_DIR` isn't committed to the repo (see `scripts/README.md` — `raw/`
 * and `data/` are instance-specific, gitignored-by-omission rather than
 * shipped as empty placeholder directories) and every write path under it
 * auto-creates its own parent directories via `Bun.write`, so the only
 * place a missing directory needs explicit handling is this read: treat
 * "directory doesn't exist" the same as "directory exists but is empty"
 * (no snapshots have ever been fetched yet) rather than letting `readdir`
 * throw `ENOENT`.
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
 * `Connector.normalize` implementation for Yandex Music (see `types.ts`).
 * Orchestrates the raw -> normalized transform:
 *
 * 1. Reads the `lastProcessed` filename cursor and lists newer
 *    `raw/yandex-music/*.json` snapshots in lexical/chronological order.
 * 2. Replays those files in chronological order through one
 *    `AlbumStore`/`ArtistStore`/`TrackStore`/`ChartStore`/history batch
 *    shared across the whole run, so entities seen in multiple snapshots
 *    correctly accumulate (or dedup) history across files, not just
 *    within one.
 * 3. Saves all four stores plus merges history, then advances the cursor
 *    to the newest processed file's timestamp.
 *
 * If step 3 (specifically the `META_FILE` write) never runs — e.g. the
 * process crashes after `save()` but before the cursor update — the next
 * run will safely reprocess the same files; `appendSnapshot`'s dedup makes
 * that a no-op for entities, and `mergeHistory` dedups by exact `date` for
 * history items.
 */
export async function normalizeYandexMusic(): Promise<void> {
    const lastProcessed = await readLastProcessed();

    const allFiles = await listRawSnapshots();
    const newFiles = allFiles.filter((name) => lastProcessed === null || name > lastProcessed);

    if (newFiles.length === 0) {
        log.info('Nothing new to normalize.');
        return;
    }

    // One store instance per entity type, shared across every file in this
    // run — lets an entity that appears in several new snapshots accumulate
    // (or dedup) its history correctly instead of each file starting fresh.
    const artists = new ArtistStore();
    const albums = new AlbumStore();
    const tracks = new TrackStore();
    const charts = new ChartStore();
    // Deliberately keyed by exact `date` (not just accumulated) across ALL
    // files in this run, not per-file — see the comment below on why a
    // later file's items for the same date replace an earlier file's.
    const historyByDate = new Map<number, HistoryItem[]>();

    for (const name of newFiles) {
        const ts = new Date(name.replace('.json', '')).getTime();
        const raw: RawHistoryResponse = await Bun.file(`${RAW_DIR}/${name}`).json();

        // `ts` (this snapshot file's timestamp) is used as the
        // `snapshotDate` for every entity touched by it — entity-level
        // snapshot granularity is "as of this raw fetch", not per-track.
        for (const day of raw.history) {
            for (const item of day.items) {
                for (const track of item.tracks) {
                    for (const artist of collectArtists(track.data.fullModel)) {
                        await artists.process(artist, ts);
                    }
                    for (const album of collectAlbums(track.data.fullModel)) {
                        await albums.process(album, ts);
                    }
                    await tracks.process(track.data.fullModel, ts);
                    await charts.process(track.data.fullModel, ts);
                }
            }
        }

        const newItems = buildHistory(raw);
        const itemsByDate = new Map<number, HistoryItem[]>();
        for (const item of newItems) {
            const bucket = itemsByDate.get(item.date) ?? [];
            bucket.push(item);
            itemsByDate.set(item.date, bucket);
        }
        // A later snapshot's view of a given day is more complete than an
        // earlier one (Yandex's history endpoint returns a growing window,
        // so a newer fetch supersedes rather than adds to an older one for
        // any date they both cover). `set()` here overwrites same-date
        // entries from earlier files in `newFiles` order, so the file
        // processed last for a given date always wins.
        for (const [date, items] of itemsByDate) {
            historyByDate.set(date, items);
        }
    }

    const allNewHistoryItems = Array.from(historyByDate.values()).flat();
    await Promise.all([
        artists.save(),
        albums.save(),
        tracks.save(),
        charts.save(),
        mergeHistory(allNewHistoryItems),
    ]);
    const indexedTracks = await writeTrackIndex(newFiles.at(-1)!);

    // Cursor advance is intentionally last: if anything above throws, this
    // line never runs and the next invocation safely reprocesses the same
    // files (see the crash-safety note on `normalizeYandexMusic` above).
    await Bun.write(META_FILE, `${JSON.stringify({ lastProcessed: newFiles.at(-1) })}\n`);

    log.notice('Processed snapshot(s)', {
        snapshots: newFiles.length,
        artists: artists.stats.total,
        albums: albums.stats.total,
        tracks: tracks.stats.total,
        historySessions: allNewHistoryItems.length,
        indexedTracks,
    });
}
