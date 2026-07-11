import type { Album, AlbumSnapshot } from '../models/album.ts';
import type { RawAlbum, RawTrackFullModel } from '../raw-types.ts';
import { SnapshotStore } from '../../../shared/snapshot-store.ts';
import { AlbumType } from '../models/album.ts';

/**
 * Extracts the distinct albums referenced by one track's `albums` array,
 * deduped by id. `RawTrackFullModel.albums` is usually a single-element
 * array but the raw API models it as a list, so this exists to normalize
 * that into "unique albums this track belongs to" for `AlbumStore.process`.
 */
export function collectAlbums(fullModel: RawTrackFullModel): RawAlbum[] {
    const seen = new Set<number>();
    const result: RawAlbum[] = [];
    for (const album of fullModel.albums) {
        if (!seen.has(album.id)) {
            seen.add(album.id);
            result.push(album);
        }
    }
    return result;
}

/** `SnapshotStore` for albums — see that class for the persistence/dedup contract this fulfills. Only implements the album-specific mapping. */
export class AlbumStore extends SnapshotStore<RawAlbum, Album, AlbumSnapshot> {
    constructor() {
        super('data/yandex-music/albums');
    }

    protected getId(raw: RawAlbum): string {
        return String(raw.id);
    }

    protected createEntity(id: string): Album {
        return { id, snapshots: [] };
    }

    protected toSnapshot(raw: RawAlbum, snapshotDate: number): AlbumSnapshot {
        let type: AlbumType | undefined;
        if (raw.type === 'single') {
            type = AlbumType.Single;
        } else if (raw.type === 'compilation') {
            type = AlbumType.Compilation;
        }

        return {
            snapshotDate,
            title: raw.title,
            ...(type !== undefined ? { type } : {}),
            releaseDate: raw.releaseDate ? new Date(raw.releaseDate).getTime() : raw.year,
            cover: raw.coverUri ?? '',
            genre: raw.genre,
            artists: raw.artists.map((a) => String(a.id)),
            labels: raw.labels.map((l) => l.name),
            trackCount: raw.trackCount,
            explicit: raw.contentWarning === 'explicit',
            veryImportant: raw.veryImportant,
            ...(raw.version ? { version: raw.version } : {}),
        };
    }
}
