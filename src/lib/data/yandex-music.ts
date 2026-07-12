import type { Album } from '../../../scripts/connectors/yandex-music/models/album';

import type { Artist } from '../../../scripts/connectors/yandex-music/models/artist';
import type { Chart } from '../../../scripts/connectors/yandex-music/models/chart';
import type { ContextType, HistoryItem } from '../../../scripts/connectors/yandex-music/models/history';

import type { Track } from '../../../scripts/connectors/yandex-music/models/track';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { cache } from 'react';
import 'server-only';

export type {
    Album,
    AlbumSnapshot,
} from '../../../scripts/connectors/yandex-music/models/album';
export type {
    Artist,
    ArtistSnapshot,
} from '../../../scripts/connectors/yandex-music/models/artist';
export type { Chart, ChartSnapshot } from '../../../scripts/connectors/yandex-music/models/chart';
export type {
    HistoryContext,
    HistoryItem,
} from '../../../scripts/connectors/yandex-music/models/history';
export { ContextType } from '../../../scripts/connectors/yandex-music/models/history';
export type { Track, TrackSnapshot } from '../../../scripts/connectors/yandex-music/models/track';

const DATA_ROOT = path.join(process.cwd(), 'data', 'yandex-music');

// Entity ids come straight from URLs and become file paths — without this
// check a crafted id is a path traversal. Yandex ids are plain digits.
const ENTITY_ID = /^\d+$/;
const MONTH_KEY = /^\d{4}-\d{2}$/;

async function readJson<T>(...segments: string[]): Promise<T | null> {
    try {
        const raw = await fs.readFile(path.join(DATA_ROOT, ...segments), 'utf8');
        return JSON.parse(raw) as T;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return null;
        }
        throw error;
    }
}

function entityReader<T>(directory: string): (id: string) => Promise<T | null> {
    return cache(async (id: string) => {
        if (!ENTITY_ID.test(id)) {
            return null;
        }
        return readJson<T>(directory, `${id}.json`);
    });
}

export const getTrack = entityReader<Track>('tracks');
export const getArtist = entityReader<Artist>('artists');
export const getAlbum = entityReader<Album>('albums');
export const getChart = entityReader<Chart>('charts');

/** Snapshots are append-only: the last one is the current state. */
export function latest<S>(entity: { snapshots: S[] } | null): S | null {
    return entity?.snapshots.at(-1) ?? null;
}

export const listHistoryMonths = cache(async (): Promise<string[]> => {
    try {
        const entries = await fs.readdir(path.join(DATA_ROOT, 'history'));
        return entries
            .filter((name) => name.endsWith('.json'))
            .map((name) => name.slice(0, -'.json'.length))
            .filter((name) => MONTH_KEY.test(name))
            .sort();
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return [];
        }
        throw error;
    }
});

export const getHistoryMonth = cache(async (month: string): Promise<HistoryItem[]> => {
    if (!MONTH_KEY.test(month)) {
        return [];
    }
    return (await readJson<HistoryItem[]>('history', `${month}.json`)) ?? [];
});

export interface TrackListenStats {
    total: number;
    /** Epoch ms of the first/last listening session containing the track. */
    firstAt: number | null;
    lastAt: number | null;
    /** One entry per archive month (zeroes included), oldest first. */
    byMonth: { month: string; count: number }[];
    /** Only contexts the track was actually played through, most-played first. */
    byContext: { context: ContextType; count: number }[];
}

export const getTrackListenStats = cache(async (trackId: string): Promise<TrackListenStats> => {
    const months = await listHistoryMonths();
    const byMonth: TrackListenStats['byMonth'] = [];
    const contextCounts = new Map<ContextType, number>();
    let total = 0;
    let firstAt: number | null = null;
    let lastAt: number | null = null;

    for (const month of months) {
        const items = await getHistoryMonth(month);
        let monthCount = 0;
        for (const item of items) {
            let inItem = 0;
            for (const id of item.tracks) {
                if (id === trackId) {
                    inItem += 1;
                }
            }
            if (inItem === 0) {
                continue;
            }
            monthCount += inItem;
            firstAt = firstAt === null ? item.date : Math.min(firstAt, item.date);
            lastAt = lastAt === null ? item.date : Math.max(lastAt, item.date);
            const type = item.context.type;
            contextCounts.set(type, (contextCounts.get(type) ?? 0) + inItem);
        }
        byMonth.push({ month, count: monthCount });
        total += monthCount;
    }

    const byContext = [...contextCounts.entries()]
        .map(([context, count]) => ({ context, count }))
        .sort((a, b) => b.count - a.count);

    return { total, firstAt, lastAt, byMonth, byContext };
});

/** `cover` fields store a protocol-less URL with a `%%` size placeholder. */
export function coverUrl(cover: string, size: number): string | null {
    if (!cover) {
        return null;
    }
    return `https://${cover.replace('%%', `${size}x${size}`)}`;
}

export interface TrackIndexEntry {
    id: string;
    title: string;
    version?: string;
    artistNames: string[];
    albumTitle?: string;
    cover: string;
    explicit: boolean;
    available: boolean;
    charted: boolean;
    listens: number;
    lastListen: number | null;
    /** Epoch ms the track first appeared in dormouse (first snapshot). */
    firstSeen: number;
}

async function listEntityIds(directory: string): Promise<string[]> {
    try {
        const entries = await fs.readdir(path.join(DATA_ROOT, directory));
        return entries
            .filter((name) => name.endsWith('.json'))
            .map((name) => name.slice(0, -'.json'.length));
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return [];
        }
        throw error;
    }
}

async function readAllEntities<T>(directory: string): Promise<Map<string, T>> {
    const ids = await listEntityIds(directory);
    const entries = await Promise.all(
        ids.map(async (id) => [id, await readJson<T>(directory, `${id}.json`)] as const),
    );
    const map = new Map<string, T>();
    for (const [id, entity] of entries) {
        if (entity !== null) {
            map.set(id, entity);
        }
    }
    return map;
}

async function buildTracksIndex(): Promise<TrackIndexEntry[]> {
    const [tracks, artists, albums, chartedIds, months] = await Promise.all([
        readAllEntities<Track>('tracks'),
        readAllEntities<Artist>('artists'),
        readAllEntities<Album>('albums'),
        listEntityIds('charts'),
        listHistoryMonths(),
    ]);

    const listens = new Map<string, { count: number; lastAt: number }>();
    for (const month of months) {
        const items = (await readJson<HistoryItem[]>('history', `${month}.json`)) ?? [];
        for (const item of items) {
            for (const id of item.tracks) {
                const entry = listens.get(id) ?? { count: 0, lastAt: 0 };
                entry.count += 1;
                entry.lastAt = Math.max(entry.lastAt, item.date);
                listens.set(id, entry);
            }
        }
    }

    const charted = new Set(chartedIds);
    const index: TrackIndexEntry[] = [];
    for (const [id, record] of tracks) {
        const snapshot = record.snapshots.at(-1);
        const firstSnapshot = record.snapshots[0];
        if (!snapshot || !firstSnapshot) {
            continue;
        }
        const played = listens.get(id);
        index.push({
            id,
            title: snapshot.title,
            version: snapshot.version,
            artistNames: snapshot.artists.map(
                (artistId) => artists.get(artistId)?.snapshots.at(-1)?.name ?? `#${artistId}`,
            ),
            albumTitle: snapshot.albums[0]
                ? albums.get(snapshot.albums[0])?.snapshots.at(-1)?.title
                : undefined,
            cover: snapshot.cover,
            explicit: snapshot.explicit,
            available: snapshot.available,
            charted: charted.has(id),
            listens: played?.count ?? 0,
            lastListen: played?.lastAt ?? null,
            firstSeen: firstSnapshot.snapshotDate,
        });
    }
    return index;
}

// Module-level, not React cache(): the index scans every entity file, and the
// data on disk only changes with a deploy — one build per server instance.
let tracksIndexPromise: Promise<TrackIndexEntry[]> | null = null;

export function getTracksIndex(): Promise<TrackIndexEntry[]> {
    tracksIndexPromise ??= buildTracksIndex().catch((error: unknown) => {
        tracksIndexPromise = null;
        throw error;
    });
    return tracksIndexPromise;
}
