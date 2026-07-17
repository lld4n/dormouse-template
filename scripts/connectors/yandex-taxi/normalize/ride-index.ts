import type { RideIndex, RideIndexEntry } from '../models/ride-index.ts';
import type { Ride } from '../models/ride.ts';
import { readEntities } from '../../../shared/entity-index.ts';

const DATA_ROOT = 'data/yandex-taxi';
const INDEX_FILE = `${DATA_ROOT}/index/rides.json`;

/**
 * Builds the one-file projection consumed by the rides list page by
 * re-scanning every `data/yandex-taxi/rides/<id>.json` on disk — a full
 * rebuild rather than an incremental merge. At this dataset's scale (a
 * personal ride-history export, not a fetched-daily firehose) re-reading
 * every ride file each normalize run is cheap, so there's no cursor/merge
 * logic to keep in sync with `RideStore`'s "newer wins" overwrite
 * semantics — this just reflects whatever is on disk right now. Sorted
 * newest-first, matching how the list page presents rides by default.
 */
export async function writeRideIndex(): Promise<number> {
    const rides = await readEntities<Ride>(`${DATA_ROOT}/rides`);

    const entries: RideIndexEntry[] = Array.from(rides.values())
        .map((ride) => ({
            id: ride.id,
            created: ride.created,
            tariff: ride.tariff,
            status: ride.status,
            cost: ride.cost,
            currency: ride.currency,
            source: ride.source.text,
            destination: ride.destinations[0]?.text ?? '',
        }))
        .sort((a, b) => b.created - a.created);

    const index: RideIndex = entries;
    await Bun.write(INDEX_FILE, `${JSON.stringify(index)}\n`);
    return entries.length;
}
