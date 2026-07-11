import type { Connector } from './types.ts';

import { yandexMusicConnector } from './yandex-music/index.ts';

/**
 * Single source of truth for which connectors the pipeline runs.
 * `scripts/update.ts` and `scripts/normalize.ts` both iterate this array —
 * they contain no per-service logic themselves. Adding a connector here is
 * the final wiring step after implementing it (see `Connector` in
 * `types.ts` for the full checklist); nothing else needs to change.
 */
export const CONNECTORS: Connector[] = [yandexMusicConnector];
