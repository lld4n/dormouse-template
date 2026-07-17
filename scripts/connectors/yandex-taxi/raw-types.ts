/**
 * Types mirroring the JSON shape of a Yandex Taxi order-history export, and
 * therefore also the shape of every `raw/yandex-taxi/*.json` snapshot file.
 * These are `normalize/rides.ts`'s read side — they exist purely to
 * describe *input* data this pipeline doesn't control, not to model the
 * domain (that's what `models/ride.ts` is for).
 *
 * Unlike `yandex-music`, there is no `update.ts` fetch behind this: Yandex
 * blocks server-side login for this export, so the user downloads it
 * manually from the app and drops it into `raw/yandex-taxi/` themselves
 * (see `update.ts`). Only the fields this pipeline actually reads are
 * declared here — the real export contains more (legal-entity boilerplate,
 * receipt render URLs, map tile image URLs, vehicle asset layer names)
 * that `buildRide` deliberately ignores.
 */

/** `[longitude, latitude]`. */
export type RawPoint = [number, number];

export interface RawRoutePlace {
    short_text: string;
    point: RawPoint;
}

export interface RawRoute {
    source: RawRoutePlace;
    destinations: RawRoutePlace[];
    /** Polyline of the actual driven path, `[longitude, latitude]` pairs in order. Absent for cancelled orders. */
    track?: RawPoint[];
}

export interface RawPaymentMethod {
    /** Observed values: `"yandex_card"`, `"card"`, `"cash"`. */
    type: string;
}

export interface RawPayment {
    cost: number;
    currency_code: string;
    /** Plain numeric string, e.g. `"20"`. */
    cashback?: string;
    /** Numeric string, occasionally suffixed with a currency template placeholder (e.g. `"40 $SIGN$$CURRENCY$"`) instead of being plain — see `parseMoney` in `normalize/rides.ts`. */
    tips?: string;
    payment_method: RawPaymentMethod;
}

export interface RawCalculation {
    surge_coefficient?: number;
}

export interface RawDriver {
    name: string;
    /** Comma-decimal string, e.g. `"4,92"`. */
    rating: string;
}

export interface RawVehicle {
    model: string;
    color_code: string;
    car_number: string;
}

/** One entry in the order-history export. */
export interface RawOrder {
    order_id: string;
    /** ISO 8601 with numeric offset, e.g. `"2026-07-17T20:50:56+0300"`. */
    created_at: string;
    tariff_internal_name: string;
    /** Observed values: `"finished"`, `"cancelled"`. */
    status: string;
    country_id: string;
    route: RawRoute;
    payment: RawPayment;
    calculation?: RawCalculation;
    driver?: RawDriver;
    vehicle?: RawVehicle;
    /** e.g. `"8 мин"` or `"1 ч 11 мин"`; absent for some cancelled orders — see `parseDuration` in `normalize/rides.ts`. */
    formatted_duration?: string;
}

/** Top-level shape of every `raw/yandex-taxi/*.json` snapshot file: the export's order list, verbatim. */
export type RawOrderHistory = RawOrder[];
