import type { ClickettaApi } from '@shared/ipc'

type AnyFn = (...args: unknown[]) => unknown

/**
 * Deep-clone object arguments to strip Vue reactivity. Electron's contextBridge
 * rejects Proxy objects ("An object could not be cloned") at the world boundary,
 * before any preload-side sanitisation can run — so it must happen here. Function
 * arguments (event callbacks) are passed through untouched.
 */
function plain(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value
  return JSON.parse(JSON.stringify(value))
}

/** Recursively wrap the bridged API so every call receives cloneable arguments. */
function wrap<T>(obj: T): T {
  const out = {} as Record<string, unknown>
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    const value = (obj as Record<string, unknown>)[key]
    if (typeof value === 'function') {
      const fn = value as AnyFn
      out[key] = (...args: unknown[]) => fn(...args.map(plain))
    } else if (value && typeof value === 'object') {
      out[key] = wrap(value)
    } else {
      out[key] = value
    }
  }
  return out as T
}

const bridge = (globalThis as unknown as { clicketta?: ClickettaApi }).clicketta

export const api: ClickettaApi = bridge
  ? wrap(bridge)
  : new Proxy({} as ClickettaApi, {
      get() {
        throw new Error('Clicketta preload bridge is not available')
      }
    })
