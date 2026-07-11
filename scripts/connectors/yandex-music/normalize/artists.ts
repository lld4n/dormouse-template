import type { Artist, ArtistSnapshot } from '../models/artist.ts';
import type { RawDecomposedArtist, RawTrackFullModel } from '../raw-types.ts';
import { SnapshotStore } from '../../../shared/snapshot-store.ts';
import { ArtistDisclaimer } from '../models/artist.ts';

/** `RawDecomposedArtist.decomposed` entries can be either nested artist objects or bare id-less name strings for artists Yandex hasn't resolved to a full record; the latter carry no id to key a `SnapshotStore` entity on, so they're filtered out entirely rather than normalized. */
function isDecomposedArtist(x: RawDecomposedArtist | string): x is RawDecomposedArtist {
    return typeof x === 'object';
}

/**
 * Recursively walks a `decomposed` collaboration tree (an artist credited
 * as e.g. "A & B" may decompose into A and B, which may themselves
 * decompose further), collecting every resolvable artist depth-first into
 * `result`, deduped by id via `seen`. Mutates both `seen` and `result` in
 * place; used as the shared recursion step by `collectArtists`.
 */
function collectDeep(
    artist: RawDecomposedArtist,
    seen: Set<number>,
    result: RawDecomposedArtist[],
): void {
    if (seen.has(artist.id)) {
        return;
    }
    seen.add(artist.id);
    result.push(artist);
    for (const child of artist.decomposed ?? []) {
        if (isDecomposedArtist(child)) {
            collectDeep(child, seen, result);
        }
    }
}

/**
 * Extracts every distinct artist reachable from one track — both its
 * direct `artists` and, transitively, each of its albums' `artists` (an
 * album can credit artists not on the track record itself, e.g. "Various
 * Artists" compilations) — flattening any multi-artist collaborations via
 * `collectDeep`. Deduped by id across both sources for `ArtistStore.process`.
 */
export function collectArtists(fullModel: RawTrackFullModel): RawDecomposedArtist[] {
    const seen = new Set<number>();
    const result: RawDecomposedArtist[] = [];
    for (const artist of fullModel.artists) {
        collectDeep(artist, seen, result);
    }
    for (const album of fullModel.albums) {
        for (const artist of album.artists) {
            collectDeep(artist, seen, result);
        }
    }
    return result;
}

/** `SnapshotStore` for artists — see that class for the persistence/dedup contract this fulfills. Only implements the artist-specific mapping. */
export class ArtistStore extends SnapshotStore<RawDecomposedArtist, Artist, ArtistSnapshot> {
    constructor() {
        super('data/yandex-music/artists');
    }

    protected getId(raw: RawDecomposedArtist): string {
        return String(raw.id);
    }

    protected createEntity(id: string): Artist {
        return { id, snapshots: [] };
    }

    protected toSnapshot(raw: RawDecomposedArtist, snapshotDate: number): ArtistSnapshot {
        const hasForeignAgent = raw.disclaimers.some((d) => d.startsWith('foreignAgent'));
        const disclaimers = hasForeignAgent ? [ArtistDisclaimer.ForeignAgent] : [];
        return {
            snapshotDate,
            name: raw.name,
            various: raw.various,
            cover: raw.cover?.uri ?? '',
            ...(raw.cutoutCover ? { cutoutCover: raw.cutoutCover.uri } : {}),
            disclaimers,
        };
    }
}
