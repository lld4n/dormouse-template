import type { Connector } from '../types.ts';
import { ConnectorService } from '../types.ts';
import { normalizeYandexMusic } from './normalize/index.ts';
import { updateYandexMusic } from './update.ts';

/**
 * Connector wiring for Yandex Music: plugs `updateYandexMusic` (fetch raw
 * listening history) and `normalizeYandexMusic` (turn it into per-entity
 * models) into the `Connector` contract. This is the only file the
 * `registry.ts` needs to import — see `types.ts` for what each phase must
 * guarantee, and `raw-types.ts` / `models/` for the data shapes involved.
 *
 * `token: 'YANDEX_MUSIC_TOKEN'` names the env var holding a Yandex Music
 * OAuth token (see https://yandex-music.readthedocs.io/ style token flows
 * used by third-party Yandex Music clients); `updateAll` reads it and
 * skips this connector if it's unset.
 */
export const yandexMusicConnector: Connector = {
    service: ConnectorService.YANDEX_MUSIC,
    token: 'YANDEX_MUSIC_TOKEN',
    update: updateYandexMusic,
    normalize: normalizeYandexMusic,
};
