import type { AlbumType } from './album.ts';

/**
 * Compact, render-ready projection of album data. Unlike `Album`, this is
 * rebuilt by normalization and deliberately contains no snapshot history.
 */
export interface AlbumIndexEntry {
    id: string;
    title: string;
    version?: string;
    /** Absent means a regular album — see `AlbumType`. */
    type?: AlbumType;
    releaseDate: number;
    cover: string;
    genre: string;
    artists: { id: string; name: string }[];
    trackCount: number;
    explicit: boolean;
    /** Lowercase searchable text for title, version, genre and artist names. */
    search: string;
    /** Sum of listens across every track on this album (a session playing two of the album's tracks counts twice, same convention as `TrackIndexEntry.listens`). */
    listens: number;
    lastListen: number | null;
    /** Epoch ms when the album first appeared in the archive. */
    firstSeen: number;
}

export interface AlbumIndex {
    schemaVersion: 1;
    /** Name of the newest raw snapshot represented by this index. */
    sourceSnapshot: string;
    albums: AlbumIndexEntry[];
}
