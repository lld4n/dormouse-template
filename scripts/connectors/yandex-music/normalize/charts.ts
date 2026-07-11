import type { Chart, ChartSnapshot } from '../models/chart.ts';
import type { RawTrackFullModel } from '../raw-types.ts';
import { SnapshotStore } from '../../../shared/snapshot-store.ts';
import { ChartProgress } from '../models/chart.ts';

/** `SnapshotStore` for chart rankings — see that class for the persistence/dedup contract this fulfills. Only implements the chart-specific mapping, plus a `shouldProcess` filter for chart-less tracks. */
export class ChartStore extends SnapshotStore<RawTrackFullModel, Chart, ChartSnapshot> {
    constructor() {
        super('data/yandex-music/charts');
    }

    /** Most tracks never chart; skip them entirely rather than creating an empty/meaningless chart entity for every track processed. */
    protected shouldProcess(raw: RawTrackFullModel): boolean {
        return raw.chart !== undefined;
    }

    protected getId(raw: RawTrackFullModel): string {
        return raw.id;
    }

    protected createEntity(trackId: string): Chart {
        return { trackId, snapshots: [] };
    }

    protected toSnapshot(raw: RawTrackFullModel, snapshotDate: number): ChartSnapshot {
        const chart = raw.chart!;
        let progress: ChartProgress;
        if (chart.progress === 'up') {
            progress = ChartProgress.Up;
        } else if (chart.progress === 'down') {
            progress = ChartProgress.Down;
        } else {
            progress = ChartProgress.Same;
        }

        return {
            snapshotDate,
            position: chart.position,
            shift: chart.shift,
            progress,
            listeners: chart.listeners,
        };
    }
}
