import type { Ride } from '../../../scripts/connectors/yandex-taxi/models/ride';

import { cache } from 'react';
import { getAllRides } from './yandex-taxi.ts';
import 'server-only';

/**
 * Aggregations for the `/yandex-taxi` overview page, computed once per
 * request from every ride (`getAllRides`) rather than precomputed at
 * normalize time — mirrors how `yandex-music.ts`'s `computeListenStats`
 * aggregates across every history month at request time instead of storing
 * a derived stats file. Safe here for the same reason: this is a personal
 * ride archive (hundreds to low thousands of small files), not a
 * fetched-daily firehose, so re-reading and re-aggregating on every visit
 * stays cheap without a versioned derived-data format to keep in sync.
 */

export interface RideRecord {
    id: string;
    source: string;
    destination: string;
    cost: number;
    currency: string;
    created: number;
}

export interface RideStats {
    totalRides: number;
    finishedRides: number;
    cancelledRides: number;
    /** `null` when there are no finished rides at all (nothing to average/sum in the primary currency). */
    currency: string | null;
    totalCost: number;
    avgCost: number;
    totalCashback: number;
    totalTips: number;
    totalDurationSeconds: number;
    firstRideAt: number | null;
    lastRideAt: number | null;
    /** Chronological, oldest first. */
    byMonth: { month: string; rides: number; cost: number }[];
    /** Index 0 = Monday .. 6 = Sunday, see `localWeekday`. */
    byWeekday: { weekday: number; count: number }[];
    /** Index = hour 0-23, see `localHour`. */
    byHour: { hour: number; count: number }[];
    byTariff: { tariff: string; count: number }[];
    byPayment: { payment: string; count: number }[];
    surgedRides: number;
    avgSurge: number | null;
    topCars: { car: string; count: number }[];
    uniqueDrivers: number;
    avgRating: number | null;
    topRoutes: { source: string; destination: string; count: number }[];
    mostExpensive: RideRecord | null;
    cheapest: RideRecord | null;
    longest: (RideRecord & { durationSeconds: number }) | null;
    /** The single most frequent pickup-or-dropoff address text; `null` if there are no rides. */
    homeAddress: string | null;
    /** Rides where every stop is within `AWAY_THRESHOLD_KM` of `homeAddress`'s location are "local"; the rest count here. */
    awayRides: number;
    farthest: (RideRecord & { distanceKm: number }) | null;
}

const AWAY_THRESHOLD_KM = 30;
/**
 * Yandex sends every timestamp in this export as `+0300` (observed across
 * the full history, including trips outside Kazan — Russia has had no DST
 * since 2014, so this holds for the whole archive). `Ride.created` is
 * already a plain UTC epoch, so "local hour/weekday" needs this fixed
 * offset re-applied rather than the server's own timezone (which would be
 * wrong wherever this app happens to be deployed) or raw UTC (which would
 * silently shift late-evening rides into the next day).
 */
const LOCAL_OFFSET_MS = 3 * 60 * 60 * 1000;

function toLocal(epochMs: number): Date {
    return new Date(epochMs + LOCAL_OFFSET_MS);
}

function localHour(epochMs: number): number {
    return toLocal(epochMs).getUTCHours();
}

/** Monday = 0 .. Sunday = 6. */
function localWeekday(epochMs: number): number {
    return (toLocal(epochMs).getUTCDay() + 6) % 7;
}

function localMonthKey(epochMs: number): string {
    const date = toLocal(epochMs);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function toRecord(ride: Ride): RideRecord {
    return {
        id: ride.id,
        source: ride.source.text,
        destination: ride.destinations[0]?.text ?? '',
        cost: ride.cost,
        currency: ride.currency,
        created: ride.created,
    };
}

function haversineKm(a: [number, number], b: [number, number]): number {
    const earthRadiusKm = 6371;
    const [lon1, lat1] = a;
    const [lon2, lat2] = b;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const sinLat = Math.sin(dLat / 2);
    const sinLon = Math.sin(dLon / 2);
    const h =
        sinLat * sinLat +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * sinLon * sinLon;
    return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Every stop (source + all destinations) a ride touches, for home-detection and distance checks. */
function ridePoints(ride: Ride): { text: string; point: [number, number] }[] {
    return [ride.source, ...ride.destinations];
}

function findHome(rides: Ride[]): { text: string; point: [number, number] } | null {
    const counts = new Map<string, { count: number; point: [number, number] }>();
    for (const ride of rides) {
        for (const { text, point } of ridePoints(ride)) {
            const entry = counts.get(text);
            if (entry) {
                entry.count += 1;
            } else {
                counts.set(text, { count: 1, point });
            }
        }
    }
    let best: { text: string; count: number; point: [number, number] } | null = null;
    for (const [text, { count, point }] of counts) {
        if (!best || count > best.count) {
            best = { text, count, point };
        }
    }
    return best ? { text: best.text, point: best.point } : null;
}

/** How far this ride strays from `home` — the farthest of its own stops. */
function maxDistanceFromHome(ride: Ride, home: { point: [number, number] }): number {
    return Math.max(...ridePoints(ride).map(({ point }) => haversineKm(point, home.point)));
}

export const getRideStats = cache(async (): Promise<RideStats> => {
    const rides = await getAllRides();

    const finished = rides.filter((ride) => ride.status !== 'cancelled');
    const cancelledRides = rides.length - finished.length;

    const currencyCounts = new Map<string, number>();
    for (const ride of finished) {
        currencyCounts.set(ride.currency, (currencyCounts.get(ride.currency) ?? 0) + 1);
    }
    const currency =
        [...currencyCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const inPrimaryCurrency = currency ? finished.filter((ride) => ride.currency === currency) : [];

    const totalCost = inPrimaryCurrency.reduce((sum, ride) => sum + ride.cost, 0);
    const totalCashback = finished.reduce((sum, ride) => sum + (ride.cashback ?? 0), 0);
    const totalTips = finished.reduce((sum, ride) => sum + (ride.tips ?? 0), 0);
    const totalDurationSeconds = rides.reduce((sum, ride) => sum + (ride.duration ?? 0), 0);

    const createdTimes = rides.map((ride) => ride.created);
    const firstRideAt = createdTimes.length ? Math.min(...createdTimes) : null;
    const lastRideAt = createdTimes.length ? Math.max(...createdTimes) : null;

    const monthMap = new Map<string, { rides: number; cost: number }>();
    for (const ride of rides) {
        const key = localMonthKey(ride.created);
        const entry = monthMap.get(key) ?? { rides: 0, cost: 0 };
        entry.rides += 1;
        if (ride.status !== 'cancelled' && ride.currency === currency) {
            entry.cost += ride.cost;
        }
        monthMap.set(key, entry);
    }
    const byMonth = [...monthMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, value]) => ({ month, ...value }));

    const weekdayCounts = Array.from({length: 7}).fill(0) as number[];
    const hourCounts = Array.from({length: 24}).fill(0) as number[];
    for (const ride of rides) {
        weekdayCounts[localWeekday(ride.created)]!++;
        hourCounts[localHour(ride.created)]!++;
    }
    const byWeekday = weekdayCounts.map((count, weekday) => ({ weekday, count }));
    const byHour = hourCounts.map((count, hour) => ({ hour, count }));

    const tariffCounts = new Map<string, number>();
    const paymentCounts = new Map<string, number>();
    const carCounts = new Map<string, number>();
    const driverNames = new Set<string>();
    const ratings: number[] = [];
    const routeCounts = new Map<string, { source: string; destination: string; count: number }>();
    let surgedRides = 0;
    let surgeSum = 0;

    for (const ride of rides) {
        tariffCounts.set(ride.tariff, (tariffCounts.get(ride.tariff) ?? 0) + 1);
        paymentCounts.set(ride.payment, (paymentCounts.get(ride.payment) ?? 0) + 1);
        if (ride.car) {
            carCounts.set(ride.car, (carCounts.get(ride.car) ?? 0) + 1);
        }
        if (ride.driver) {
            driverNames.add(ride.driver);
        }
        if (ride.rating !== null) {
            ratings.push(ride.rating);
        }
        if (ride.surge !== null && ride.surge > 1) {
            surgedRides += 1;
            surgeSum += ride.surge;
        }
        const destination = ride.destinations[0]?.text ?? '';
        const routeKey = `${ride.source.text} -> ${destination}`;
        const entry = routeCounts.get(routeKey) ?? {
            source: ride.source.text,
            destination,
            count: 0,
        };
        entry.count += 1;
        routeCounts.set(routeKey, entry);
    }

    const byTariff = [...tariffCounts.entries()]
        .map(([tariff, count]) => ({ tariff, count }))
        .sort((a, b) => b.count - a.count);
    const byPayment = [...paymentCounts.entries()]
        .map(([payment, count]) => ({ payment, count }))
        .sort((a, b) => b.count - a.count);
    const topCars = [...carCounts.entries()]
        .map(([car, count]) => ({ car, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
    const topRoutes = [...routeCounts.values()].sort((a, b) => b.count - a.count).slice(0, 8);

    const finishedWithCurrency = inPrimaryCurrency;
    const mostExpensive = finishedWithCurrency.length
        ? toRecord(
              finishedWithCurrency.reduce((max, ride) => (ride.cost > max.cost ? ride : max)),
          )
        : null;
    const cheapest = finishedWithCurrency.length
        ? toRecord(
              finishedWithCurrency.reduce((min, ride) => (ride.cost < min.cost ? ride : min)),
          )
        : null;
    const timedRides = rides.filter((ride) => ride.duration !== null);
    const longest = timedRides.length
        ? (() => {
              const ride = timedRides.reduce((max, candidate) =>
                  candidate.duration! > max.duration! ? candidate : max,
              );
              return { ...toRecord(ride), durationSeconds: ride.duration! };
          })()
        : null;

    const home = findHome(rides);
    let awayRides = 0;
    let farthest: RideStats['farthest'] = null;
    if (home) {
        for (const ride of rides) {
            const distanceKm = maxDistanceFromHome(ride, home);
            if (distanceKm > AWAY_THRESHOLD_KM) {
                awayRides += 1;
            }
            if (!farthest || distanceKm > farthest.distanceKm) {
                farthest = { ...toRecord(ride), distanceKm };
            }
        }
    }

    return {
        totalRides: rides.length,
        finishedRides: finished.length,
        cancelledRides,
        currency,
        totalCost,
        avgCost: inPrimaryCurrency.length ? totalCost / inPrimaryCurrency.length : 0,
        totalCashback,
        totalTips,
        totalDurationSeconds,
        firstRideAt,
        lastRideAt,
        byMonth,
        byWeekday,
        byHour,
        byTariff,
        byPayment,
        surgedRides,
        avgSurge: surgedRides > 0 ? surgeSum / surgedRides : null,
        topCars,
        uniqueDrivers: driverNames.size,
        avgRating: ratings.length ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : null,
        topRoutes,
        mostExpensive,
        cheapest,
        longest,
        homeAddress: home?.text ?? null,
        awayRides,
        farthest,
    };
});
