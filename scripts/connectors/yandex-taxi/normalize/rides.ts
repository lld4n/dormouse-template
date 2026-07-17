import type { Ride } from '../models/ride.ts';
import type { RawOrder } from '../raw-types.ts';
import { dequal } from 'dequal';

/**
 * Parses a leading numeric amount off a raw money string, discarding any
 * trailing currency template Yandex sometimes leaves un-substituted (e.g.
 * `"40 $SIGN$$CURRENCY$"`) — `payment.cashback` is always seen as a
 * plain numeric string, but `payment.tips` has been observed with this
 * template suffix, so both go through the same parser rather than assuming
 * either shape. Returns `null` for `undefined`/unparseable input.
 */
function parseMoney(value: string | undefined): number | null {
    if (value === undefined) {
        return null;
    }
    const match = /^(\d+(?:\.\d+)?)/.exec(value.trim());
    return match ? Number.parseFloat(match[1]!) : null;
}

/** Parses a comma-decimal rating string (e.g. `"4,92"`) into a number. Returns `null` for `undefined`/unparseable input. */
function parseRating(value: string | undefined): number | null {
    if (value === undefined) {
        return null;
    }
    const parsed = Number.parseFloat(value.replace(',', '.'));
    return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Parses `formatted_duration` (e.g. `"8 мин"`, `"1 ч 11 мин"`) into total
 * seconds. Returns `null` for `undefined`/unparseable input (some cancelled
 * orders omit this field entirely).
 */
function parseDuration(value: string | undefined): number | null {
    if (value === undefined) {
        return null;
    }
    const hours = /(\d+)\s*ч/.exec(value);
    const minutes = /(\d+)\s*мин/.exec(value);
    if (!hours && !minutes) {
        return null;
    }
    const h = hours ? parseInt(hours[1]!, 10) : 0;
    const m = minutes ? parseInt(minutes[1]!, 10) : 0;
    return (h * 60 + m) * 60;
}

/** Pure raw -> `Ride` mapping; does not read or write `data/`. */
export function buildRide(raw: RawOrder): Ride {
    return {
        id: raw.order_id,
        created: new Date(raw.created_at).getTime(),
        tariff: raw.tariff_internal_name,
        status: raw.status,
        country: raw.country_id,
        source: {
            text: raw.route.source.short_text,
            point: raw.route.source.point,
        },
        destinations: raw.route.destinations.map((destination) => ({
            text: destination.short_text,
            point: destination.point,
        })),
        track: raw.route.track ?? [],
        cost: raw.payment.cost,
        currency: raw.payment.currency_code,
        cashback: parseMoney(raw.payment.cashback),
        tips: parseMoney(raw.payment.tips),
        payment: raw.payment.payment_method.type,
        surge: raw.calculation?.surge_coefficient ?? null,
        driver: raw.driver?.name ?? null,
        rating: parseRating(raw.driver?.rating),
        car: raw.vehicle?.model ?? null,
        car_color: raw.vehicle?.color_code ?? null,
        car_number: raw.vehicle?.car_number ?? null,
        duration: parseDuration(raw.formatted_duration),
    };
}

/**
 * Persistence for `Ride`s: one JSON file per id at `<dir>/<id>.json`,
 * overwritten wholesale (not snapshot-appended — see the `Ride` JSDoc for
 * why this isn't a `SnapshotStore`) whenever `process()` sees a version
 * that differs from what's cached/on-disk. Mirrors `SnapshotStore`'s
 * load-once-per-run caching and `created`/`updated`/`unchanged` stats, but
 * without the append-only snapshot array.
 */
export class RideStore {
    /** Rides loaded or written so far this run, keyed by id — `null` means confirmed absent on disk. */
    private cache = new Map<string, Ride | null>();
    /** Ids whose current-in-`cache` value still needs writing to disk. */
    private dirty = new Map<string, Ride>();
    private createdIds = new Set<string>();
    private changedIds = new Set<string>();

    /** @param dir - Output directory, e.g. `data/yandex-taxi/rides`. */
    constructor(private readonly dir: string) {}

    /** Ingests one `Ride`; writes it only if it's new or differs from the cached/on-disk version. Safe to call more than once per id in a run — later calls win. */
    async process(ride: Ride): Promise<void> {
        const existing = await this.getOrLoad(ride.id);
        if (existing && dequal(existing, ride)) {
            return;
        }
        if (existing) {
            this.changedIds.add(ride.id);
        } else {
            this.createdIds.add(ride.id);
        }
        this.cache.set(ride.id, ride);
        this.dirty.set(ride.id, ride);
    }

    /** Writes every dirty ride back to `<dir>/<id>.json` in parallel. */
    async save(): Promise<void> {
        await Promise.all(
            Array.from(this.dirty.entries()).map(([id, ride]) =>
                Bun.write(`${this.dir}/${id}.json`, `${JSON.stringify(ride)}\n`),
            ),
        );
    }

    get stats(): { total: number; created: number; updated: number; unchanged: number } {
        const total = this.cache.size;
        const created = this.createdIds.size;
        const updated = this.changedIds.size;
        return { total, created, updated, unchanged: total - created - updated };
    }

    private async getOrLoad(id: string): Promise<Ride | null> {
        if (this.cache.has(id)) {
            return this.cache.get(id)!;
        }
        const file = Bun.file(`${this.dir}/${id}.json`);
        const ride = (await file.exists()) ? await file.json() : null;
        this.cache.set(id, ride);
        return ride;
    }
}
