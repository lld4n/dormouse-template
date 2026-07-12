/**
 * Compact, render-ready projection of track data. Unlike `Track`, this is
 * rebuilt by normalization and deliberately contains no snapshot history.
 */
export interface TrackIndexEntry {
    id: string;
    title: string;
    version?: string;
    artists: { id: string; name: string }[];
    albums: { id: string; title: string }[];
    cover: string;
    /** Lowercase searchable text for title, version, artist and album names. */
    search: string;
    listens: number;
    lastListen: number | null;
    /** Epoch ms when the track first appeared in the archive. */
    firstSeen: number;
}

export interface TrackIndex {
    schemaVersion: 1;
    /** Name of the newest raw snapshot represented by this index. */
    sourceSnapshot: string;
    tracks: TrackIndexEntry[];
}
