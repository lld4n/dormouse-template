/**
 * Normalized album entity, built by `AlbumStore` (`normalize/albums.ts`)
 * from `RawAlbum` (`raw-types.ts`) records and persisted to
 * `data/yandex-music/albums/<id>.json` via `SnapshotStore`.
 */

/** Absent means a regular album (neither a single nor a compilation) — see `normalize/albums.ts`'s `type` mapping. */
export enum AlbumType {
    Single = 'single',
    Compilation = 'compilation',
}

/** One point-in-time observation of an album's metadata; a new one is appended only when a field below actually changes (see `appendSnapshot`). */
export interface AlbumSnapshot {
    /** Epoch ms this snapshot was captured at — the timestamp of the `raw/` file it came from, not necessarily when the album was released. */
    snapshotDate: number;
    title: string;
    type?: AlbumType;
    /** Epoch ms. Derived from `RawAlbum.releaseDate` when present, else falls back to `RawAlbum.year` (a bare year number used as-is). */
    releaseDate: number;
    cover: string;
    genre: string;
    /** `Artist.id` references, not embedded artist objects — join against `data/yandex-music/artists/<id>.json` to resolve. */
    artists: string[];
    labels: string[];
    trackCount: number;
    explicit: boolean;
    veryImportant: boolean;
    version?: string;
}

/** Root record for one album; `id` matches Yandex's album id and the `<id>.json` filename under `data/yandex-music/albums/`. */
export interface Album {
    id: string;
    snapshots: AlbumSnapshot[];
}
