import type {
    AlbumContext,
    ArtistContext,
    HistoryContext,
    HistoryItem,
    OtherContext,
    PlaylistContext,
    SearchContext,
    WaveContext,
} from '../models/history.ts';
import type { RawContext, RawHistoryResponse } from '../raw-types.ts';
import { ContextType, WaveSeedType } from '../models/history.ts';

/**
 * History normalization has no `SnapshotStore` — history items are
 * immutable events (not entities with revisable metadata), so they're
 * merged by exact-`date` dedup (`mergeHistory`) into monthly files instead
 * of per-id snapshot files. `buildHistory` does the raw -> `HistoryItem[]`
 * mapping; `mergeHistory` does the disk merge.
 */
const DIR = 'data/yandex-music/history';

/** Formats an epoch-ms date as its `YYYY-MM` bucket key (UTC), used both as the output filename stem and as the in-memory grouping key in `mergeHistory`. */
function monthKey(date: number): string {
    const d = new Date(date);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

/**
 * Parses a Wave station id like `"album:12345"`, `"onyourwave"`, or
 * `"personal:collection"` into a structured `WaveContext`. Station ids are
 * an undocumented Yandex encoding observed to follow a
 * `<prefix>[:<value>]` shape; prefixes recognized here map to a specific
 * `WaveSeedType` with `value` as the seed's id, `onyourwave`/`personal`
 * are special-cased as seedId-less station kinds, and anything else falls
 * back to `Reshuffle` (Yandex's shuffle-everything station) since that's
 * the only kind of Wave session left unaccounted for once the known
 * prefixes are excluded — not a confirmed mapping, just the least-wrong
 * default for unrecognized ids.
 */
function parseWaveContext(stationId: string): WaveContext {
    const colonIdx = stationId.indexOf(':');
    const prefix = colonIdx === -1 ? stationId : stationId.slice(0, colonIdx);
    const value = colonIdx === -1 ? '' : stationId.slice(colonIdx + 1);

    let seedType: WaveSeedType;
    let seedId: string | undefined;

    if (prefix === 'album') {
        seedType = WaveSeedType.Album;
        seedId = value;
    } else if (prefix === 'artist') {
        seedType = WaveSeedType.Artist;
        seedId = value;
    } else if (prefix === 'track') {
        seedType = WaveSeedType.Track;
        seedId = value;
    } else if (prefix === 'playlist') {
        seedType = WaveSeedType.Playlist;
        seedId = value;
    } else if (value === 'onyourwave') {
        seedType = WaveSeedType.OnYourWave;
    } else if (prefix === 'personal') {
        seedType = WaveSeedType.Collection;
    } else {
        seedType = WaveSeedType.Reshuffle;
    }

    return seedId !== undefined
        ? { type: ContextType.Wave, seedType, seedId }
        : { type: ContextType.Wave, seedType };
}

/**
 * Maps a `RawContext` to the matching `HistoryContext` union member based
 * on `context.type`. `context.data` (and its nested fields) is genuinely
 * optional per observed API responses, so every field read here falls
 * back to an empty string rather than propagating `undefined` — keeps
 * `HistoryContext`'s non-Wave variants' fields required (simpler for
 * consumers) at the cost of occasionally storing `''` for a field Yandex
 * didn't actually send. Unrecognized `context.type` values fall through
 * to `OtherContext`.
 */
function parseContext(context: RawContext): HistoryContext {
    const data = context.data;

    if (context.type === 'wave') {
        return parseWaveContext(data?.fullModel.wave?.stationId ?? '');
    }
    if (context.type === 'album') {
        const albumContext: AlbumContext = {
            type: ContextType.Album,
            albumId: data?.itemId.id ?? '',
        };
        return albumContext;
    }
    if (context.type === 'artist') {
        const artistContext: ArtistContext = {
            type: ContextType.Artist,
            artistId: data?.itemId.id ?? '',
        };
        return artistContext;
    }
    if (context.type === 'playlist') {
        const playlist = data?.fullModel.playlist;
        const playlistContext: PlaylistContext = {
            type: ContextType.Playlist,
            title: playlist?.title ?? '',
            cover: playlist?.cover.uri ?? '',
        };
        return playlistContext;
    }
    if (context.type === 'search') {
        const searchContext: SearchContext = { type: ContextType.Search };
        return searchContext;
    }
    const otherContext: OtherContext = { type: ContextType.Other };
    return otherContext;
}

/**
 * Flattens one raw snapshot's `history` (days -> items -> tracks) into a
 * flat `HistoryItem[]`, one entry per listening session. Pure transform —
 * does not read or write `data/`; `mergeHistory` is what persists the
 * result. Called once per new raw snapshot file in `normalize/index.ts`'s
 * main loop.
 */
export function buildHistory(raw: RawHistoryResponse): HistoryItem[] {
    const items: HistoryItem[] = [];
    for (const day of raw.history) {
        const date = new Date(day.date).getTime();
        for (const item of day.items) {
            items.push({
                date,
                context: parseContext(item.context),
                tracks: item.tracks.map((t) => t.data.fullModel.id),
            });
        }
    }
    return items;
}

/**
 * Merges `newItems` into `data/yandex-music/history/<YYYY-MM>.json`, one
 * file per calendar month, deduplicating by exact `date` timestamp against
 * whatever's already on disk for that month. Unlike `SnapshotStore`
 * entities, history items are never revised in place — a `date` collision
 * means "already recorded", so the incoming item is silently dropped
 * rather than merged/replaced. Months with nothing new to add are left
 * untouched on disk (no rewrite).
 *
 * Only called once per `normalizeYandexMusic` run, with items from every
 * new raw file combined (post the caller's own cross-file "later file
 * wins per date" resolution in `normalize/index.ts` — by the time items
 * reach here, at most one item per `date` exists in `newItems`).
 *
 * @returns Counts of distinct new dates and touched month-files written — currently informational only; no caller consumes this (`normalize/index.ts` calls `mergeHistory` inside a `Promise.all` and discards the result). Kept in case per-run history stats are surfaced later.
 */
export async function mergeHistory(
    newItems: HistoryItem[],
): Promise<{ newDays: number; months: number }> {
    const byMonth = new Map<string, HistoryItem[]>();
    for (const item of newItems) {
        const key = monthKey(item.date);
        const bucket = byMonth.get(key) ?? [];
        bucket.push(item);
        byMonth.set(key, bucket);
    }

    let newDays = 0;
    let months = 0;

    await Promise.all(
        Array.from(byMonth.entries()).map(async ([key, items]) => {
            const file = Bun.file(`${DIR}/${key}.json`);
            const existing: HistoryItem[] = (await file.exists()) ? await file.json() : [];
            const existingDates = new Set(existing.map((i) => i.date));
            const toAppend = items.filter((i) => !existingDates.has(i.date));
            if (toAppend.length === 0) {
                return;
            }
            newDays += new Set(toAppend.map((i) => i.date)).size;
            months++;
            const merged = [...existing, ...toAppend].sort((a, b) => a.date - b.date);
            await Bun.write(`${DIR}/${key}.json`, `${JSON.stringify(merged)}\n`);
        }),
    );

    return { newDays, months };
}
