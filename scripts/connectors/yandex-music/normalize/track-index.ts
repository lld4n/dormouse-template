import type { Album } from '../models/album.ts';
import type { Artist } from '../models/artist.ts';
import type { HistoryItem } from '../models/history.ts';
import type { TrackIndex, TrackIndexEntry } from '../models/track-index.ts';
import type { Track } from '../models/track.ts';

import { listJsonNames, readEntities } from '../../../shared/entity-index.ts';

const DATA_ROOT = 'data/yandex-music';
const INDEX_FILE = `${DATA_ROOT}/index/tracks.json`;

async function collectListens(): Promise<Map<string, { count: number; lastAt: number }>> {
    const listens = new Map<string, { count: number; lastAt: number }>();
    const months = await listJsonNames(`${DATA_ROOT}/history`);

    for (const month of months) {
        const items: HistoryItem[] = await Bun.file(`${DATA_ROOT}/history/${month}`).json();
        for (const item of items) {
            for (const id of item.tracks) {
                const entry = listens.get(id) ?? { count: 0, lastAt: 0 };
                entry.count += 1;
                entry.lastAt = Math.max(entry.lastAt, item.date);
                listens.set(id, entry);
            }
        }
    }

    return listens;
}

/** Builds the one-file projection consumed by the tracks list page. */
export async function writeTrackIndex(sourceSnapshot: string): Promise<number> {
    const [tracks, artists, albums, listens] = await Promise.all([
        readEntities<Track>(`${DATA_ROOT}/tracks`),
        readEntities<Artist>(`${DATA_ROOT}/artists`),
        readEntities<Album>(`${DATA_ROOT}/albums`),
        collectListens(),
    ]);

    const entries: TrackIndexEntry[] = [];
    for (const [id, record] of tracks) {
        const snapshot = record.snapshots.at(-1);
        const firstSnapshot = record.snapshots[0];
        if (!snapshot || !firstSnapshot) {
            continue;
        }

        const indexArtists = snapshot.artists.map((artistId) => ({
            id: artistId,
            name: artists.get(artistId)?.snapshots.at(-1)?.name ?? `#${artistId}`,
        }));
        const indexAlbums = snapshot.albums.map((albumId) => ({
            id: albumId,
            title: albums.get(albumId)?.snapshots.at(-1)?.title ?? `#${albumId}`,
        }));
        const played = listens.get(id);
        const search = [
            snapshot.title,
            snapshot.version,
            ...indexArtists.map(({ name }) => name),
            ...indexAlbums.map(({ title }) => title),
        ]
            .filter(Boolean)
            .join(' ')
            .toLocaleLowerCase();

        entries.push({
            id,
            title: snapshot.title,
            ...(snapshot.version ? { version: snapshot.version } : {}),
            artists: indexArtists,
            albums: indexAlbums,
            cover: snapshot.cover,
            search,
            listens: played?.count ?? 0,
            lastListen: played?.lastAt ?? null,
            firstSeen: firstSnapshot.snapshotDate,
        });
    }

    const index: TrackIndex = { schemaVersion: 1, sourceSnapshot, tracks: entries };
    await Bun.write(INDEX_FILE, `${JSON.stringify(index)}\n`);
    return entries.length;
}
