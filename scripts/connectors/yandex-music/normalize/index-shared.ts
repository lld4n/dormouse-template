import { readdir } from 'node:fs/promises';

const READ_CONCURRENCY = 32;

/** Lists the `.json` files directly inside `directory`, sorted. Missing directories read as empty rather than throwing. */
export async function listJsonNames(directory: string): Promise<string[]> {
    try {
        return (await readdir(directory)).filter((name) => name.endsWith('.json')).sort();
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return [];
        }
        throw error;
    }
}

/** Reads every entity JSON file in `directory` into a map keyed by its filename (sans `.json`), i.e. its id. */
export async function readEntities<T>(directory: string): Promise<Map<string, T>> {
    const names = await listJsonNames(directory);
    const entities = new Map<string, T>();
    let next = 0;

    await Promise.all(
        Array.from({ length: Math.min(READ_CONCURRENCY, names.length) }, async () => {
            while (next < names.length) {
                const name = names[next++]!;
                const id = name.slice(0, -'.json'.length);
                entities.set(id, await Bun.file(`${directory}/${name}`).json());
            }
        }),
    );

    return entities;
}
