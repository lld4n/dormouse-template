import type { AlbumIndex, AlbumIndexEntry } from '../models/album-index.ts';
import type { Album } from '../models/album.ts';
import type { Artist } from '../models/artist.ts';
import type { HistoryItem } from '../models/history.ts';
import type { Track } from '../models/track.ts';

import { listJsonNames, readEntities } from '../../../shared/entity-index.ts';

const DATA_ROOT = 'data/yandex-music';
const INDEX_FILE = `${DATA_ROOT}/index/albums.json`;

/**
 * Sums track listens onto the album(s) each track belongs to. History only
 * records track ids, so this joins through each track's latest snapshot
 * (`Track.snapshots.at(-1).albums`) to attribute a listen to its album(s) —
 * a track on two albums (e.g. a reissue) contributes to both.
 */
async function collectAlbumListens(
    tracks: Map<string, Track>,
): Promise<Map<string, { count: number; lastAt: number }>> {
    const trackAlbums = new Map<string, string[]>();
    for (const [id, record] of tracks) {
        const snapshot = record.snapshots.at(-1);
        if (snapshot) {
            trackAlbums.set(id, snapshot.albums);
        }
    }

    const listens = new Map<string, { count: number; lastAt: number }>();
    const months = await listJsonNames(`${DATA_ROOT}/history`);

    for (const month of months) {
        const items: HistoryItem[] = await Bun.file(`${DATA_ROOT}/history/${month}`).json();
        for (const item of items) {
            for (const trackId of item.tracks) {
                for (const albumId of trackAlbums.get(trackId) ?? []) {
                    const entry = listens.get(albumId) ?? { count: 0, lastAt: 0 };
                    entry.count += 1;
                    entry.lastAt = Math.max(entry.lastAt, item.date);
                    listens.set(albumId, entry);
                }
            }
        }
    }

    return listens;
}

/** Builds the one-file projection consumed by the albums list page. */
export async function writeAlbumIndex(sourceSnapshot: string): Promise<number> {
    const [albums, artists, tracks] = await Promise.all([
        readEntities<Album>(`${DATA_ROOT}/albums`),
        readEntities<Artist>(`${DATA_ROOT}/artists`),
        readEntities<Track>(`${DATA_ROOT}/tracks`),
    ]);
    const listens = await collectAlbumListens(tracks);

    const entries: AlbumIndexEntry[] = [];
    for (const [id, record] of albums) {
        const snapshot = record.snapshots.at(-1);
        const firstSnapshot = record.snapshots[0];
        if (!snapshot || !firstSnapshot) {
            continue;
        }

        const indexArtists = snapshot.artists.map((artistId) => ({
            id: artistId,
            name: artists.get(artistId)?.snapshots.at(-1)?.name ?? `#${artistId}`,
        }));
        const played = listens.get(id);
        const search = [
            snapshot.title,
            snapshot.version,
            snapshot.genre,
            ...indexArtists.map(({ name }) => name),
        ]
            .filter(Boolean)
            .join(' ')
            .toLocaleLowerCase();

        entries.push({
            id,
            title: snapshot.title,
            ...(snapshot.version ? { version: snapshot.version } : {}),
            ...(snapshot.type !== undefined ? { type: snapshot.type } : {}),
            releaseDate: snapshot.releaseDate,
            cover: snapshot.cover,
            genre: snapshot.genre,
            artists: indexArtists,
            trackCount: snapshot.trackCount,
            explicit: snapshot.explicit,
            search,
            listens: played?.count ?? 0,
            lastListen: played?.lastAt ?? null,
            firstSeen: firstSnapshot.snapshotDate,
        });
    }

    const index: AlbumIndex = { schemaVersion: 1, sourceSnapshot, albums: entries };
    await Bun.write(INDEX_FILE, `${JSON.stringify(index)}\n`);
    return entries.length;
}
