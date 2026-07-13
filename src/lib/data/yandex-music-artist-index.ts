import type { ArtistIndex } from '../../../scripts/connectors/yandex-music/models/artist-index';

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { cache } from 'react';
import 'server-only';

const INDEX_PATH = path.join(
    process.cwd(),
    'data',
    'yandex-music',
    'index',
    'artists.json',
);

/** Reads the compact list projection written by Yandex Music normalization. */
export const getArtistsIndex = cache(async () => {
    try {
        return (JSON.parse(await fs.readFile(INDEX_PATH, 'utf8')) as ArtistIndex).artists;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return [];
        }
        throw error;
    }
});

export type { ArtistIndexEntry } from '../../../scripts/connectors/yandex-music/models/artist-index';
