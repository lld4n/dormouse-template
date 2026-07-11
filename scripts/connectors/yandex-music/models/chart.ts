/**
 * Normalized chart-ranking history for a track, built by `ChartStore`
 * (`normalize/charts.ts`) from `RawChart` (`raw-types.ts`, embedded in
 * `RawTrackFullModel.chart`) and persisted to
 * `data/yandex-music/charts/<trackId>.json` via `SnapshotStore`. Only
 * tracks that were on a chart at least once get a file here — most tracks
 * never will (see `ChartStore.shouldProcess`).
 */

export enum ChartProgress {
    Up = 'up',
    Down = 'down',
    Same = 'same',
}

/** One point-in-time chart position observation; a new one is appended only when a field below actually changes (see `appendSnapshot`). */
export interface ChartSnapshot {
    /** Epoch ms this snapshot was captured at. */
    snapshotDate: number;
    /** 1-based chart rank. */
    position: number;
    /** Position change since the previous chart update, as reported by Yandex (not derived from `snapshots` history here). */
    shift: number;
    progress: ChartProgress;
    listeners: number;
}

/** Root record for one track's chart history; `trackId` matches `Track.id` (this file intentionally does NOT use `id` as the key name, to make clear it's keyed by an external reference rather than owning its own identity). */
export interface Chart {
    trackId: string;
    snapshots: ChartSnapshot[];
}
