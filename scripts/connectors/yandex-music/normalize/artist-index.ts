import type { Album } from '../models/album.ts';
import type { ArtistIndex, ArtistIndexEntry } from '../models/artist-index.ts';
import type { Artist } from '../models/artist.ts';
import type { HistoryItem } from '../models/history.ts';
import type { Track } from '../models/track.ts';

import { listJsonNames, readEntities } from '../../../shared/entity-index.ts';
import { ArtistDisclaimer } from '../models/artist.ts';

const DATA_ROOT = 'data/yandex-music';
const INDEX_FILE = `${DATA_ROOT}/index/artists.json`;

/**
 * Sums track listens onto the artist(s) credited on each track. History only
 * records track ids, so this joins through each track's latest snapshot
 * (`Track.snapshots.at(-1).artists`) to attribute a listen to its artist(s) —
 * a track crediting two artists contributes to both.
 */
async function collectArtistListens(
    tracks: Map<string, Track>,
): Promise<Map<string, { count: number; lastAt: number }>> {
    const trackArtists = new Map<string, string[]>();
    for (const [id, record] of tracks) {
        const snapshot = record.snapshots.at(-1);
        if (snapshot) {
            trackArtists.set(id, snapshot.artists);
        }
    }

    const listens = new Map<string, { count: number; lastAt: number }>();
    const months = await listJsonNames(`${DATA_ROOT}/history`);

    for (const month of months) {
        const items: HistoryItem[] = await Bun.file(`${DATA_ROOT}/history/${month}`).json();
        for (const item of items) {
            for (const trackId of item.tracks) {
                for (const artistId of trackArtists.get(trackId) ?? []) {
                    const entry = listens.get(artistId) ?? { count: 0, lastAt: 0 };
                    entry.count += 1;
                    entry.lastAt = Math.max(entry.lastAt, item.date);
                    listens.set(artistId, entry);
                }
            }
        }
    }

    return listens;
}

function countCredits<T extends { snapshots: { artists: string[] }[] }>(
    entities: Map<string, T>,
): Map<string, number> {
    const counts = new Map<string, number>();
    for (const [, record] of entities) {
        const snapshot = record.snapshots.at(-1);
        if (!snapshot) {
            continue;
        }
        for (const artistId of snapshot.artists) {
            counts.set(artistId, (counts.get(artistId) ?? 0) + 1);
        }
    }
    return counts;
}

/** Builds the one-file projection consumed by the artists list page. */
export async function writeArtistIndex(sourceSnapshot: string): Promise<number> {
    const [artists, tracks, albums] = await Promise.all([
        readEntities<Artist>(`${DATA_ROOT}/artists`),
        readEntities<Track>(`${DATA_ROOT}/tracks`),
        readEntities<Album>(`${DATA_ROOT}/albums`),
    ]);
    const listens = await collectArtistListens(tracks);
    const trackCounts = countCredits(tracks);
    const albumCounts = countCredits(albums);

    const entries: ArtistIndexEntry[] = [];
    for (const [id, record] of artists) {
        const snapshot = record.snapshots.at(-1);
        const firstSnapshot = record.snapshots[0];
        if (!snapshot || !firstSnapshot) {
            continue;
        }

        const played = listens.get(id);

        entries.push({
            id,
            name: snapshot.name,
            cover: snapshot.cover,
            various: snapshot.various,
            foreignAgent: snapshot.disclaimers.includes(ArtistDisclaimer.ForeignAgent),
            search: snapshot.name.toLocaleLowerCase(),
            trackCount: trackCounts.get(id) ?? 0,
            albumCount: albumCounts.get(id) ?? 0,
            listens: played?.count ?? 0,
            lastListen: played?.lastAt ?? null,
            firstSeen: firstSnapshot.snapshotDate,
        });
    }

    const index: ArtistIndex = { schemaVersion: 1, sourceSnapshot, artists: entries };
    await Bun.write(INDEX_FILE, `${JSON.stringify(index)}\n`);
    return entries.length;
}
