import { dequal } from 'dequal';

/**
 * Core dedup rule behind every entity's `snapshots: TSnapshot[]` array
 * (see `SnapshotStore` in `snapshot-store.ts`, which calls this for every
 * processed record). An entity accumulates append-only history, but a new
 * snapshot is only kept if something besides the timestamp actually
 * changed — otherwise a track/artist/album that's identical across 50
 * daily `update` runs would produce 50 redundant entries instead of one.
 *
 * Mutates `snapshots` in place (pushes `newSnap`) when a change is
 * detected; leaves it untouched otherwise. Comparison is deep-equality via
 * `dequal` over every field except `snapshotDate`, so field order/identity
 * doesn't matter, only value.
 *
 * @returns `true` if `newSnap` was appended (first snapshot, or differs from the last one), `false` if it was a no-op duplicate.
 */
export function appendSnapshot<TSnap extends { snapshotDate: number }>(
    snapshots: TSnap[],
    newSnap: TSnap,
): boolean {
    if (snapshots.length === 0) {
        snapshots.push(newSnap);
        return true;
    }

    const { snapshotDate: _last, ...lastFields } = snapshots.at(-1)!;
    const { snapshotDate: _new, ...newFields } = newSnap;

    if (dequal(lastFields, newFields)) {
        return false;
    }

    snapshots.push(newSnap);
    return true;
}
