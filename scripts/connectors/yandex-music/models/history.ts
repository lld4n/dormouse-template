/**
 * Normalized listening-history entity: not a `SnapshotStore`-backed entity
 * like tracks/artists/albums/charts (history events don't get revised
 * after the fact, so there's nothing to snapshot/dedup), instead built by
 * `buildHistory` and merged to disk by `mergeHistory`, both in
 * `normalize/history.ts`. Persisted as one file per calendar month —
 * `data/yandex-music/history/<YYYY-MM>.json` — holding a flat,
 * date-sorted `HistoryItem[]`.
 */

/** What kind of listening context a `HistoryItem` was played through. Discriminant for the `HistoryContext` union below. */
export enum ContextType {
    Wave = 'wave',
    Album = 'album',
    Artist = 'artist',
    Playlist = 'playlist',
    Search = 'search',
    Other = 'other',
}

/**
 * What "seeded" a Wave (Yandex's endless-radio feature) session. Parsed
 * from a compact `<prefix>:<id>` station id string by `parseWaveContext`
 * in `normalize/history.ts` — see that function for the exact prefix ->
 * seed type mapping, including the special-cased `onyourwave`/`personal`
 * values that don't carry a `seedId`.
 */
export enum WaveSeedType {
    Album = 'album',
    Artist = 'artist',
    Track = 'track',
    Playlist = 'playlist',
    /** Yandex's personalized default station, not seeded by a specific entity. */
    OnYourWave = 'onyourwave',
    /** Seeded by the user's own liked-tracks collection. */
    Collection = 'collection',
    /** Station id didn't match any known prefix; `parseWaveContext`'s fallback. */
    Reshuffle = 'reshuffle',
}

export interface WaveContext {
    type: ContextType.Wave;
    seedType: WaveSeedType;
    /** Id of the seeding entity (album/artist/track/playlist id, matching that entity's own `id` field) — absent for seed types that aren't tied to one specific entity. */
    seedId?: string;
}

/** `albumId` is an `Album.id` reference — join against `data/yandex-music/albums/<id>.json`. */
export interface AlbumContext {
    type: ContextType.Album;
    albumId: string;
}

/** `artistId` is an `Artist.id` reference — join against `data/yandex-music/artists/<id>.json`. */
export interface ArtistContext {
    type: ContextType.Artist;
    artistId: string;
}

/** Playlists aren't a normalized entity of their own (unlike albums/artists), so their metadata is embedded directly here rather than referenced by id. */
export interface PlaylistContext {
    type: ContextType.Playlist;
    title: string;
    cover: string;
}

export interface SearchContext {
    type: ContextType.Search;
}

/** Catch-all for `RawContext.type` values `parseContext` (`normalize/history.ts`) doesn't explicitly recognize. */
export interface OtherContext {
    type: ContextType.Other;
}

/** Discriminated union on `type`; narrow with a `switch`/`if` on `.type` to access the context-specific fields. */
export type HistoryContext =
    WaveContext | AlbumContext | ArtistContext | PlaylistContext | SearchContext | OtherContext;

/**
 * One listening session as recorded by Yandex: a batch of tracks played
 * together under a single context (e.g. one Wave session, or one pass
 * through an album). Yandex only records a track here once it's played
 * past 50% of its duration — not a full listen, and not one row per track
 * played (a `HistoryItem` can list several `tracks`).
 */
export interface HistoryItem {
    /** Epoch ms. Acts as this item's dedup key in `mergeHistory` — two items with the same `date` are treated as the same event, so exact collisions (down to the millisecond) would be dropped as duplicates rather than both kept. */
    date: number;
    context: HistoryContext;
    /** `Track.id` references, in play order — join against `data/yandex-music/tracks/<id>.json`. */
    tracks: string[];
}
