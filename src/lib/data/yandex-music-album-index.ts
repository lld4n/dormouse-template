import type { AlbumIndex } from '../../../scripts/connectors/yandex-music/models/album-index';

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { cache } from 'react';
import 'server-only';

const INDEX_PATH = path.join(
    process.cwd(),
    'data',
    'yandex-music',
    'index',
    'albums.json',
);

/** Reads the compact list projection written by Yandex Music normalization. */
export const getAlbumsIndex = cache(async () => {
    try {
        return (JSON.parse(await fs.readFile(INDEX_PATH, 'utf8')) as AlbumIndex).albums;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return [];
        }
        throw error;
    }
});

export type { AlbumIndexEntry } from '../../../scripts/connectors/yandex-music/models/album-index';
