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
export { AlbumType } from '../../../scripts/connectors/yandex-music/models/album';
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

export interface ListenStats {
    total: number;
    /** Epoch ms of the first/last listening session containing the track(s). */
    firstAt: number | null;
    lastAt: number | null;
    /** One entry per archive month (zeroes included), oldest first. */
    byMonth: { month: string; count: number }[];
    /** Only contexts actually played through, most-played first. */
    byContext: { context: ContextType; count: number }[];
}

/** Shared aggregation: `countInItem` returns how many of a history item's plays should count (0 to skip it entirely). */
async function computeListenStats(countInItem: (item: HistoryItem) => number): Promise<ListenStats> {
    const months = await listHistoryMonths();
    const byMonth: ListenStats['byMonth'] = [];
    const contextCounts = new Map<ContextType, number>();
    let total = 0;
    let firstAt: number | null = null;
    let lastAt: number | null = null;

    for (const month of months) {
        const items = await getHistoryMonth(month);
        let monthCount = 0;
        for (const item of items) {
            const inItem = countInItem(item);
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
}

export const getTrackListenStats = cache(async (trackId: string): Promise<ListenStats> => {
    return computeListenStats((item) => item.tracks.filter((id) => id === trackId).length);
});

/** Aggregates listens across every track on an album (a session playing two of the album's tracks counts twice). */
export const getAlbumListenStats = cache(async (trackIds: string[]): Promise<ListenStats> => {
    const idSet = new Set(trackIds);
    return computeListenStats((item) => item.tracks.filter((id) => idSet.has(id)).length);
});

/** `cover` fields store a protocol-less URL with a `%%` size placeholder. */
export function coverUrl(cover: string, size: number): string | null {
    if (!cover) {
        return null;
    }
    return `https://${cover.replace('%%', `${size}x${size}`)}`;
}
