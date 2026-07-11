/**
 * Normalized track entity, built by `TrackStore` (`normalize/tracks.ts`)
 * from `RawTrackFullModel` (`raw-types.ts`) records and persisted to
 * `data/yandex-music/tracks/<id>.json` via `SnapshotStore`.
 */

export interface TrackLyrics {
    /** Time-synced (karaoke-style) lyrics are available for this track. */
    sync: boolean;
    /** Plain-text lyrics are available for this track. */
    text: boolean;
}

/** One point-in-time observation of a track's metadata; a new one is appended only when a field below actually changes (see `appendSnapshot`). */
export interface TrackSnapshot {
    /** Epoch ms this snapshot was captured at. */
    snapshotDate: number;
    title: string;
    /** `false` for tracks Yandex has since made unavailable (removed, region-locked, etc.) — history entries referencing them remain valid. */
    available: boolean;
    explicit: boolean;
    /** Derived from `disclaimers` containing a `"foreignAgent*"` entry; mirrors `ArtistDisclaimer.ForeignAgent` but kept as a flat boolean here rather than an enum array (no other track-level disclaimer kinds are tracked). */
    foreignAgent: boolean;
    durationMs: number;
    /** `Artist.id` references — join against `data/yandex-music/artists/<id>.json` to resolve. */
    artists: string[];
    /** `Album.id` references — join against `data/yandex-music/albums/<id>.json` to resolve. */
    albums: string[];
    cover: string;
    lyrics: TrackLyrics;
    version?: string;
    /** Cover-art-derived UI colors, passed through from `RawDerivedColors`; both present or both absent. */
    backgroundColor?: string;
    textColor?: string;
    /**
     * Set only when the raw record's `id` differed from its `realId`
     * (Yandex resolved this history entry to a canonical duplicate track).
     * Points at the canonical `Track.id` this entry's `id` was merged
     * into — follow it to find the "real" track record if this one looks
     * sparse/orphaned.
     */
    substitutedId?: string;
}

/** Root record for one track; `id` matches Yandex's (possibly non-canonical, see `substitutedId`) track id and the `<id>.json` filename under `data/yandex-music/tracks/`. */
export interface Track {
    id: string;
    snapshots: TrackSnapshot[];
}
