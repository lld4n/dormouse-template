import type { Track, TrackSnapshot } from '../models/track.ts';
import type { RawTrackFullModel } from '../raw-types.ts';
import { SnapshotStore } from '../../../shared/snapshot-store.ts';

/** `SnapshotStore` for tracks — see that class for the persistence/dedup contract this fulfills. Only implements the track-specific mapping. */
export class TrackStore extends SnapshotStore<RawTrackFullModel, Track, TrackSnapshot> {
    constructor() {
        super('data/yandex-music/tracks');
    }

    protected getId(raw: RawTrackFullModel): string {
        return raw.id;
    }

    protected createEntity(id: string): Track {
        return { id, snapshots: [] };
    }

    protected toSnapshot(raw: RawTrackFullModel, snapshotDate: number): TrackSnapshot {
        const foreignAgent = raw.disclaimers.some((d) => d.startsWith('foreignAgent'));
        return {
            snapshotDate,
            title: raw.title ?? '',
            available: raw.available,
            explicit: raw.contentWarning === 'explicit',
            foreignAgent,
            durationMs: raw.durationMs ?? 0,
            artists: raw.artists.map((a) => String(a.id)),
            albums: raw.albums.map((a) => String(a.id)),
            cover: raw.coverUri ?? '',
            lyrics: {
                sync: raw.lyricsInfo?.hasAvailableSyncLyrics ?? false,
                text: raw.lyricsInfo?.hasAvailableTextLyrics ?? false,
            },
            ...(raw.version ? { version: raw.version } : {}),
            ...(raw.derivedColors
                ? {
                      backgroundColor: raw.derivedColors.average,
                      textColor: raw.derivedColors.waveText,
                  }
                : {}),
            ...(raw.id !== raw.realId ? { substitutedId: raw.realId } : {}),
        };
    }
}
