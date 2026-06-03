import type { Store } from './store'
import { MemoryStore } from './memory'

export { MemoryStore } from './memory'
export { SqliteStore } from './sqlite'
export * from './store'

/**
 * Open the SQLite-backed store, falling back to an in-memory store if the native
 * better-sqlite3 binary cannot be loaded (keeps the app usable rather than
 * crashing on a broken native build).
 */
export async function openStore(filename: string): Promise<Store> {
  try {
    const { SqliteStore } = await import('./sqlite')
    return new SqliteStore(filename)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[db] SQLite unavailable, using in-memory store:', (err as Error).message)
    return new MemoryStore()
  }
}
