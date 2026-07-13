/**
 * Compact, render-ready projection of artist data. Unlike `Artist`, this is
 * rebuilt by normalization and deliberately contains no snapshot history.
 */
export interface ArtistIndexEntry {
    id: string;
    name: string;
    cover: string;
    /** `true` for "Various Artists"-style placeholder entries rather than a real individual/group. */
    various: boolean;
    foreignAgent: boolean;
    /** Lowercase searchable text — just the name, nothing else identifies an artist. */
    search: string;
    /** Count of tracks crediting this artist. */
    trackCount: number;
    /** Count of albums crediting this artist. */
    albumCount: number;
    /** Sum of listens across every track crediting this artist (a track with two credited artists counts toward both). */
    listens: number;
    lastListen: number | null;
    /** Epoch ms when the artist first appeared in the archive. */
    firstSeen: number;
}

export interface ArtistIndex {
    schemaVersion: 1;
    /** Name of the newest raw snapshot represented by this index. */
    sourceSnapshot: string;
    artists: ArtistIndexEntry[];
}
