/**
 * Normalized taxi-ride entity, one file per ride at
 * `data/yandex-taxi/rides/<id>.json`. Unlike the `SnapshotStore`-backed
 * entities in `yandex-music` (tracks/artists/albums/charts), a `Ride` has
 * no append-only `snapshots[]` history — a ride isn't revised metadata
 * observed over time, it's the record of one trip. `RideStore`
 * (`normalize/rides.ts`) instead overwrites a ride's file wholesale
 * whenever a newer export's view of it differs, on the premise that a
 * later export is always at least as complete/accurate as an earlier one
 * (e.g. a ride still `driving` in one export may show `finished` with a
 * final `cost` in the next).
 */

/** A point along a route. `point` is `[longitude, latitude]`, matching the raw export's order. */
export interface RidePlace {
    text: string;
    point: [number, number];
}

export interface Ride {
    /** Yandex's `order_id`; stable across re-exports, used as this ride's filename. */
    id: string;
    /** Epoch ms. */
    created: number;
    /** Yandex's internal tariff slug (e.g. `"business"`, `"econom"`, `"comfortplus"`) — stable across locales, unlike the human-facing `tariff_class` label this pipeline doesn't keep. Localize for display in the UI rather than storing the Russian label. */
    tariff: string;
    /** Observed values: `"finished"`, `"cancelled"`. */
    status: string;
    /** ISO-3166 alpha-3-ish country code as Yandex sends it, e.g. `"rus"`. */
    country: string;
    source: RidePlace;
    destinations: RidePlace[];
    /** Polyline of the actual driven path, `[longitude, latitude]` pairs in route order. Empty for cancelled orders. */
    track: [number, number][];
    cost: number;
    /** ISO 4217 currency code, e.g. `"RUB"`. */
    currency: string;
    /** `null` when the export has no cashback field for this ride, not when cashback was zero. */
    cashback: number | null;
    tips: number | null;
    /** Payment method slug from the raw export (e.g. `"yandex_card"`, `"card"`, `"cash"`) — localize for display rather than storing Yandex's Russian method title. */
    payment: string;
    /** `null` means no surge was applied (raw omits the field entirely rather than sending `1`). */
    surge: number | null;
    driver: string | null;
    /** Parsed from the raw comma-decimal string (e.g. `"4,92"` -> `4.92`). */
    rating: number | null;
    car: string | null;
    /** Hex color code, without a leading `#`, as the raw export sends it (e.g. `"E4E8ED"`). */
    car_color: string | null;
    car_number: string | null;
    /** Parsed from `formatted_duration` (e.g. `"1 ч 11 мин"` -> `4260`). `null` when the export omits it (seen on some cancelled orders). */
    duration: number | null;
}
