import type { RideIndex } from '../../../scripts/connectors/yandex-taxi/models/ride-index';

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { cache } from 'react';
import 'server-only';

const INDEX_PATH = path.join(process.cwd(), 'data', 'yandex-taxi', 'index', 'rides.json');

/** Reads the compact list projection written by Yandex Taxi normalization. */
export const getRidesIndex = cache(async (): Promise<RideIndex> => {
    try {
        return JSON.parse(await fs.readFile(INDEX_PATH, 'utf8')) as RideIndex;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return [];
        }
        throw error;
    }
});

export type { RideIndexEntry } from '../../../scripts/connectors/yandex-taxi/models/ride-index';
