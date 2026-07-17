import type { Connector } from '../types.ts';
import { ConnectorService } from '../types.ts';
import { normalizeYandexTaxi } from './normalize/index.ts';
import { updateYandexTaxi } from './update.ts';

/**
 * Connector wiring for Yandex Taxi: `updateYandexTaxi` is a permanent
 * no-op (see its JSDoc — this connector is manual-export-only, there's no
 * API to fetch from) and `normalizeYandexTaxi` turns whatever the user has
 * manually placed under `raw/yandex-taxi/` into per-ride models. This is
 * the only file `registry.ts` needs to import.
 *
 * `token: 'YANDEX_TAXI_TOKEN'` names a repository secret that is never
 * actually set — see `update.ts` for why that's the intended steady
 * state, not a TODO.
 */
export const yandexTaxiConnector: Connector = {
    service: ConnectorService.YANDEX_TAXI,
    token: 'YANDEX_TAXI_TOKEN',
    update: updateYandexTaxi,
    normalize: normalizeYandexTaxi,
};
