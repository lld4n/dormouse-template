/**
 * Types mirroring the JSON shape returned by Yandex Music's undocumented
 * internal `music-history` API (see `update.ts`), and therefore also the
 * shape of everything saved under `raw/yandex-music/*.json` via
 * `saveSnapshot`. These are `normalize/index.ts`'s read side — they exist
 * purely to describe *input* data this pipeline doesn't control, not to
 * model the domain (that's what `models/` is for).
 *
 * Because the API is undocumented and reverse-engineered from observed
 * responses, fields are marked optional (`?`) wherever they've been seen
 * missing/absent, and only the properties this pipeline actually reads are
 * declared — the real API responses likely contain more fields than
 * modeled here. If Yandex changes response shapes, this is the file to
 * update; `raw/` snapshots already saved under the old shape remain valid
 * JSON but may not parse cleanly against a changed interface here.
 */

export interface RawCover {
    uri: string;
}

/**
 * An artist as embedded in a track/album response. "Decomposed" refers to
 * Yandex's own naming for multi-artist collaborations being split into
 * constituent artists via `decomposed` — entries there can be nested
 * `RawDecomposedArtist` objects or bare name strings for artists Yandex
 * hasn't resolved to a full artist record (see `isDecomposedArtist` in
 * `normalize/artists.ts`, which filters these out).
 */
export interface RawDecomposedArtist {
    id: number;
    name: string;
    various: boolean;
    /** Free-form warning tags; `"foreignAgent*"` entries drive `ArtistDisclaimer.ForeignAgent` in `normalize/artists.ts`. */
    disclaimers: string[];
    cover?: RawCover;
    cutoutCover?: RawCover;
    decomposed?: Array<RawDecomposedArtist | string>;
}

export interface RawAlbum {
    id: number;
    title: string;
    /** Observed values: `"single"`, `"compilation"`, or absent for a regular album — see the mapping in `normalize/albums.ts`. */
    type?: string;
    /** Release year; used as a fallback when `releaseDate` is absent (see `normalize/albums.ts`). */
    year: number;
    /** ISO-ish date string; preferred over `year` when present since it carries more precision. */
    releaseDate?: string;
    coverUri?: string;
    genre: string;
    trackCount: number;
    veryImportant: boolean;
    /** e.g. `"Deluxe Edition"` — distinguishes re-releases of the same `title`. */
    version?: string;
    /** `"explicit"` is the only value this pipeline checks for (see `normalize/albums.ts`); other values are ignored. */
    contentWarning?: string;
    artists: RawDecomposedArtist[];
    labels: { name: string }[];
}

export interface RawLyricsInfo {
    hasAvailableSyncLyrics: boolean;
    hasAvailableTextLyrics: boolean;
}

/** Yandex-computed color palette derived from cover art, used for UI theming on their end; passed through as-is in `TrackSnapshot`. */
export interface RawDerivedColors {
    average: string;
    waveText: string;
}

/** Present only on tracks currently ranked on a Yandex chart; absence means `ChartStore.shouldProcess` skips the track entirely. */
export interface RawChart {
    position: number;
    shift: number;
    /** Observed values: `"up"`, `"down"`, `"same"` — mapped to `ChartProgress` in `normalize/charts.ts`. */
    progress: string;
    listeners: number;
}

export interface RawTrackFullModel {
    /**
     * Track id as it appears in this listening-history context. May differ
     * from `realId` for tracks Yandex has merged/deduplicated across
     * releases — see `substitutedId` handling in `normalize/tracks.ts`.
     */
    id: string;
    /** Canonical track id after Yandex-side deduplication; compared against `id` to detect substitution. */
    realId: string;
    title?: string;
    available: boolean;
    /** `"explicit"` is the only value this pipeline checks for. */
    contentWarning?: string;
    /** `"foreignAgent*"` entries drive the `foreignAgent` flag in `normalize/tracks.ts`. */
    disclaimers: string[];
    durationMs?: number;
    artists: RawDecomposedArtist[];
    /** Usually one album, but the API models it as an array (e.g. compilations the track also appears on). */
    albums: RawAlbum[];
    coverUri?: string;
    version?: string;
    lyricsInfo?: RawLyricsInfo;
    derivedColors?: RawDerivedColors;
    chart?: RawChart;
}

export interface RawTrackData {
    fullModel: RawTrackFullModel;
}

export interface RawTrack {
    data: RawTrackData;
}

export interface RawContextItemId {
    /** Present for `album`/`artist` context types; the referenced entity's id. */
    id?: string;
}

export interface RawContextFullModel {
    /** Present when `RawContext.type === 'wave'`; `stationId` is a compact encoded seed, see `parseWaveContext` in `normalize/history.ts`. */
    wave?: { stationId: string };
    /** Present when `RawContext.type === 'playlist'`. */
    playlist?: { title: string; cover: RawCover };
}

export interface RawContextData {
    itemId: RawContextItemId;
    fullModel: RawContextFullModel;
}

/**
 * What the user was listening *through* when a history item was recorded
 * (a Wave/radio station, an album, an artist page, a playlist, search
 * results, ...). See `parseContext` in `normalize/history.ts` for the full
 * mapping to `HistoryContext`; `type` values not explicitly handled there
 * fall through to `ContextType.Other`.
 */
export interface RawContext {
    type: string;
    data?: RawContextData;
}

export interface RawHistoryItem {
    context: RawContext;
    tracks: RawTrack[];
}

/** One calendar day's worth of listening, as grouped by Yandex itself (not by this pipeline). */
export interface RawHistoryDay {
    date: string;
    items: RawHistoryItem[];
}

/** Top-level shape of both the Yandex API response body (wrapped, see `update.ts`) and every `raw/yandex-music/*.json` snapshot file. */
export interface RawHistoryResponse {
    history: RawHistoryDay[];
}
