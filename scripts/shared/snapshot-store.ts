import { appendSnapshot } from './snapshot.ts';

/**
 * Aggregate counts returned by `SnapshotStore.stats` after a normalize run,
 * purely for the human-readable summary line each connector logs (see
 * `yandex-music/normalize/index.ts`). `total` = `created + updated + unchanged`.
 */
export interface StoreStats {
    /** Number of distinct entities touched (loaded or created) during this run. */
    total: number;
    /** Of `total`, how many did not exist on disk before this run (new `<dir>/<id>.json` files). */
    created: number;
    /** Of `total`, how many existed already and got a new snapshot appended. */
    updated: number;
    /** Of `total`, how many existed already but every processed record deduped away (no-op, see `appendSnapshot`). */
    unchanged: number;
}

interface Snapshotted<TSnapshot> {
    snapshots: TSnapshot[];
}

/**
 * Generic persistence engine for "one JSON file per entity id, containing
 * an append-only, deduplicated history of snapshots" — the storage pattern
 * shared by every normalized entity type (tracks, artists, albums, charts,
 * ...) across every connector. This is the class that made `AlbumStore` /
 * `ArtistStore` / `TrackStore` / `ChartStore` in
 * `connectors/yandex-music/normalize/*.ts` collapse from ~90 duplicated
 * lines each down to ~20 lines of pure mapping logic.
 *
 * ## What it does for you
 * - Lazily loads each entity's existing `<dir>/<id>.json` on first touch
 *   this run, caches it in memory for subsequent `process()` calls with
 *   the same id (so a single normalize pass never re-reads a file twice).
 * - Deduplicates snapshots via `appendSnapshot` (skips writing a new
 *   snapshot if nothing but the date changed).
 * - Batches all touched entities to disk in one `Promise.all` on `save()`.
 * - Tracks `created`/`updated`/`unchanged` counts for `stats`.
 *
 * ## What you provide (subclass responsibilities)
 * Extend this class per entity type and implement:
 * - `getId(raw)` — stable string id derived from the raw record; determines the output filename (`<dir>/<id>.json`).
 * - `createEntity(id)` — shape of a brand-new entity before any snapshot is appended (e.g. `{ id, snapshots: [] }`).
 * - `toSnapshot(raw, snapshotDate)` — maps one raw record + a timestamp into this entity's snapshot type.
 * - `shouldProcess(raw)` (optional, defaults to always-true) — return `false` to skip raw records that don't apply to this entity type (see `ChartStore`, which skips tracks with no chart data).
 *
 * ## Adding a new snapshot-backed entity type
 * 1. Define `<Entity>` (`{ id: string; snapshots: <Entity>Snapshot[] }`) and `<Entity>Snapshot` (`{ snapshotDate: number; ...fields }`) in `models/`.
 * 2. `export class <Entity>Store extends SnapshotStore<RawShape, Entity, EntitySnapshot>` in `normalize/`, pointed at its own `data/<service>/<entities>` directory.
 * 3. Instantiate it, call `.process(raw, snapshotDate)` per raw record while walking snapshot files, then `.save()` once at the end (see `normalize/index.ts` for the orchestration pattern).
 *
 * Callers must call `save()` exactly once after all `process()` calls —
 * nothing is written to disk incrementally.
 */
export abstract class SnapshotStore<
    TRaw,
    TEntity extends Snapshotted<TSnapshot>,
    TSnapshot extends { snapshotDate: number },
> {
    /** Entities loaded or created so far this run, keyed by id — also the write-back set for `save()`. */
    private touched = new Map<string, TEntity>();
    /** Ids that had no existing file on disk (i.e. were freshly created this run). */
    private isNew = new Set<string>();
    /** Ids for which at least one `process()` call actually appended a new snapshot (vs. deduping away). */
    private snapshotAdded = new Set<string>();

    /** @param dir - Output directory for this entity type, e.g. `data/yandex-music/albums`. One file per id: `<dir>/<id>.json`. */
    constructor(private readonly dir: string) {}

    /**
     * Ingests one raw record as of `snapshotDate`: resolves/loads its
     * entity, appends a snapshot if the mapped fields changed, and updates
     * bookkeeping for `stats`. Safe to call many times per id across a run
     * (e.g. once per raw snapshot file being replayed) — repeated calls
     * for the same id reuse the cached in-memory entity rather than
     * re-reading from disk.
     *
     * @param raw - One raw record from a connector's fetched API response.
     * @param snapshotDate - Timestamp (ms epoch) this record was observed at; becomes the new snapshot's `snapshotDate` if appended.
     */
    async process(raw: TRaw, snapshotDate: number): Promise<void> {
        if (!this.shouldProcess(raw)) {
            return;
        }

        const id = this.getId(raw);
        const entity = await this.getOrLoad(id);
        const before = entity.snapshots.length;
        appendSnapshot(entity.snapshots, this.toSnapshot(raw, snapshotDate));
        if (entity.snapshots.length > before) {
            this.snapshotAdded.add(id);
        }
    }

    /**
     * Writes every touched entity (created or loaded via `process()`) back
     * to `<dir>/<id>.json` in parallel. Entities that were loaded but
     * ended up unchanged are still rewritten — harmless (identical
     * content) but means `save()` is not a cheap no-op even when nothing
     * new happened.
     */
    async save(): Promise<void> {
        await Promise.all(
            Array.from(this.touched.entries()).map(([id, entity]) =>
                Bun.write(`${this.dir}/${id}.json`, `${JSON.stringify(entity)}\n`),
            ),
        );
    }

    /** Snapshot of run counters; see `StoreStats` field docs. Safe to read at any point, typically after all `process()` calls. */
    get stats(): StoreStats {
        const total = this.touched.size;
        const created = this.isNew.size;
        const updated = [...this.snapshotAdded].filter((id) => !this.isNew.has(id)).length;
        return { total, created, updated, unchanged: total - created - updated };
    }

    /**
     * Filter hook run before every `process()`. Override to skip raw
     * records that don't produce an instance of this entity — e.g.
     * `ChartStore` returns `false` for tracks with no `chart` field so it
     * doesn't create a bogus all-empty chart entry for every track.
     * Default: process everything.
     */
    protected shouldProcess(_raw: TRaw): boolean {
        return true;
    }

    /** Derives this record's entity id. Must be stable across snapshots of the "same" real-world entity — it's the output filename. */
    protected abstract getId(raw: TRaw): string;
    /** Shape of a brand-new entity (no snapshots yet) for an id with no existing file on disk. */
    protected abstract createEntity(id: string): TEntity;
    /** Maps one raw record into this entity's snapshot shape at the given timestamp. */
    protected abstract toSnapshot(raw: TRaw, snapshotDate: number): TSnapshot;

    /**
     * Returns the cached in-memory entity for `id` if this run has already
     * touched it; otherwise reads `<dir>/<id>.json` from disk (or
     * synthesizes a fresh one via `createEntity` if it doesn't exist yet)
     * and caches it in `touched` for the rest of the run.
     */
    private async getOrLoad(id: string): Promise<TEntity> {
        const cached = this.touched.get(id);
        if (cached) {
            return cached;
        }
        const file = Bun.file(`${this.dir}/${id}.json`);
        const exists = await file.exists();
        const entity: TEntity = exists ? await file.json() : this.createEntity(id);
        if (!exists) {
            this.isNew.add(id);
        }
        this.touched.set(id, entity);
        return entity;
    }
}
