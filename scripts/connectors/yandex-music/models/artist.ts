/**
 * Normalized artist entity, built by `ArtistStore` (`normalize/artists.ts`)
 * from `RawDecomposedArtist` (`raw-types.ts`) records and persisted to
 * `data/yandex-music/artists/<id>.json` via `SnapshotStore`.
 */

/** Legal/regulatory tag Yandex attaches to certain artists (e.g. Russia's "foreign agent" designation), surfaced separately from the free-form raw `disclaimers` strings so downstream code doesn't need to parse them. */
export enum ArtistDisclaimer {
    ForeignAgent = 'foreignAgent',
}

/** One point-in-time observation of an artist's metadata; a new one is appended only when a field below actually changes (see `appendSnapshot`). */
export interface ArtistSnapshot {
    /** Epoch ms this snapshot was captured at. */
    snapshotDate: number;
    name: string;
    /** `true` for "Various Artists"-style placeholder entries rather than a real individual/group. */
    various: boolean;
    cover: string;
    /** Alternate cutout-style artwork Yandex provides for some artists; absent for most. */
    cutoutCover?: string;
    disclaimers: ArtistDisclaimer[];
}

/** Root record for one artist; `id` matches Yandex's artist id and the `<id>.json` filename under `data/yandex-music/artists/`. */
export interface Artist {
    id: string;
    snapshots: ArtistSnapshot[];
}
