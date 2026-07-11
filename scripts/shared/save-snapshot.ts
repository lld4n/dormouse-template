/**
 * Writes one raw API response verbatim to `raw/<service>/<YYYY-MM-DD>.json`.
 * This is the ONLY way connectors should persist fetched data — it's the
 * boundary between phase 1 (`update`) and phase 2 (`normalize`).
 *
 * Snapshots are immutable and append-only by filename: calling this twice
 * on the same UTC day for the same service overwrites that day's file
 * (there's no dedup/merge here — `normalize` is what interprets snapshot
 * contents and decides what's new). `raw/` is never rewritten by
 * `normalize`, so it always holds the full unprocessed history the
 * pipeline has ever fetched and can be replayed if normalization logic
 * changes.
 *
 * @param service - Directory name, conventionally a `ConnectorService` value.
 * @param data - Arbitrary JSON-serializable payload; shape is connector-defined (see e.g. `RawHistoryResponse`).
 * @returns The relative path written to, for logging.
 */
export async function saveSnapshot(service: string, data: unknown): Promise<string> {
    const date = new Date().toISOString().slice(0, 10);
    const filename = `raw/${service}/${date}.json`;

    await Bun.write(filename, `${JSON.stringify(data)}\n`);

    return filename;
}
