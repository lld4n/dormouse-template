import { logger } from '../../shared/logger.ts';

const log = logger.child('yandex-taxi');

/**
 * `Connector.update` implementation for Yandex Taxi (see `types.ts`) — a
 * deliberate permanent no-op, not a placeholder to fill in later. Yandex
 * blocks this order-history export from server-side/automated login, so
 * there is no API this pipeline can call on a schedule; the user exports
 * their history from the app themselves and drops the file into
 * `raw/yandex-taxi/<YYYY-MM-DD-HH-mm>.json` by hand (the timestamp is the
 * export's download time, not a processing date).
 *
 * This still satisfies the `Connector` contract (rather than omitting
 * `update` and special-casing manual-only connectors in `update.ts`) by
 * pointing `token` at `YANDEX_TAXI_TOKEN` — a repository secret that is
 * never actually set. `updateAll`'s existing missing-token handling then
 * skips this connector on every run without treating that as a failure,
 * which is exactly the "connector present, nothing to fetch" state this
 * connector is permanently in. `normalizeYandexTaxi` (`normalize/index.ts`)
 * is the phase that actually does something for this connector.
 */
export async function updateYandexTaxi(_token: string): Promise<void> {
    log.notice('Manual-only connector; nothing to fetch.');
}
