/**
 * The one-file projection consumed by the rides list page:
 * `data/yandex-taxi/index/rides.json`. Deliberately excludes `Ride` fields
 * a list view has no use for (`track`, `driver`, `car*`, `rating`, ...) —
 * those stay in the per-ride file at `data/yandex-taxi/rides/<id>.json`
 * for the detail page to read on its own. Without this split, a list page
 * would have to load every ride's full record (including its route
 * polyline) just to render a sortable table — see `writeRideIndex` in
 * `normalize/ride-index.ts`, which rebuilds this file from scratch each
 * normalize run since the full `rides/` directory is cheap to re-scan at
 * this dataset's scale.
 */
export interface RideIndexEntry {
    id: string;
    created: number;
    tariff: string;
    status: string;
    cost: number;
    currency: string;
    source: string;
    /** First destination's text only — later stops (multi-stop rides) are in the full `Ride` record. */
    destination: string;
}

export type RideIndex = RideIndexEntry[];
