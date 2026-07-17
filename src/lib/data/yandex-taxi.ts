import type { Ride } from '../../../scripts/connectors/yandex-taxi/models/ride';

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { cache } from 'react';
import 'server-only';

export type { Ride, RidePlace } from '../../../scripts/connectors/yandex-taxi/models/ride';

const DATA_ROOT = path.join(process.cwd(), 'data', 'yandex-taxi');

// Entity ids come straight from URLs and become file paths — without this
// check a crafted id is a path traversal. Yandex order ids are 32 lowercase hex chars.
const RIDE_ID = /^[a-f0-9]{32}$/;

/** Reads one ride's full record (route polyline, driver, vehicle, ...). `null` for an unknown/invalid id. */
export const getRide = cache(async (id: string): Promise<Ride | null> => {
    if (!RIDE_ID.test(id)) {
        return null;
    }
    try {
        const raw = await fs.readFile(path.join(DATA_ROOT, 'rides', `${id}.json`), 'utf8');
        return JSON.parse(raw) as Ride;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return null;
        }
        throw error;
    }
});

/**
 * Reads every ride's full record — used by the overview page, which
 * aggregates fields (`driver`, `car`, `surge`, `duration`, ...) the compact
 * list index deliberately excludes. Deliberately plain `Promise.all` rather
 * than `readEntities`'s batched concurrency (`scripts/shared/entity-index.ts`):
 * that helper is built on `Bun.file`, which this Next.js server code doesn't
 * assume is available, and at this dataset's scale (a personal ride
 * archive, not a fetched-daily firehose) an unbatched `Promise.all` over
 * every file is already cheap.
 */
export const getAllRides = cache(async (): Promise<Ride[]> => {
    let names: string[];
    try {
        names = (await fs.readdir(path.join(DATA_ROOT, 'rides'))).filter((name) =>
            name.endsWith('.json'),
        );
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return [];
        }
        throw error;
    }

    return Promise.all(
        names.map(async (name) => {
            const raw = await fs.readFile(path.join(DATA_ROOT, 'rides', name), 'utf8');
            return JSON.parse(raw) as Ride;
        }),
    );
});
