import { logger } from '../../shared/logger.ts';
import { saveSnapshot } from '../../shared/save-snapshot.ts';

const log = logger.child('yandex-music');

/**
 * `Connector.update` implementation for Yandex Music (see `types.ts`).
 * Fetches the account's full listening history from Yandex's undocumented
 * internal `music-history` API in one request and writes it verbatim as
 * today's raw snapshot — no transformation happens here, that's
 * `normalizeYandexMusic`'s job.
 *
 * The response's `result.historyTabs` array is wrapped as
 * `{ history: tabs }` before saving so the saved shape matches
 * `RawHistoryResponse` in `raw-types.ts` (the type `normalize/index.ts`
 * reads snapshot files as).
 *
 * `fullModelsCount=999999999` asks Yandex for the entire history in one
 * page rather than a paginated/truncated tab list — an undocumented but
 * observed-working API quirk, not an official parameter contract.
 *
 * @param token - Yandex Music OAuth token (resolved from `YANDEX_MUSIC_TOKEN` by `updateAll`), sent as `Authorization: OAuth <token>`.
 * @throws If the HTTP request fails (non-2xx response).
 */
export async function updateYandexMusic(token: string): Promise<void> {
    const response = await fetch(
        'https://api.music.yandex.net/music-history?fullModelsCount=999999999',
        {
            headers: { Authorization: `OAuth ${token}` },
        },
    );

    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { result: { historyTabs: unknown[] } };
    const tabs = data.result.historyTabs;

    const filename = await saveSnapshot('yandex-music', { history: tabs });

    log.notice(`Saved ${tabs.length} history tabs`, { file: filename });
}
