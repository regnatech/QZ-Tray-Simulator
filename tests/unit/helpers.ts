import { AppBus } from '../../src/main/core/bus'
import { Logger } from '../../src/main/core/logger'
import { MemoryStore } from '../../src/main/db/memory'
import { PrinterManager } from '../../src/main/engine/printerManager'
import type { AppEvent } from '../../src/shared/types'

export interface TestHarness {
  store: MemoryStore
  bus: AppBus
  log: Logger
  manager: PrinterManager
  events: AppEvent[]
}

/** Build an isolated engine wired to an in-memory store, capturing all events. */
export function makeHarness(seed = true): TestHarness {
  const store = new MemoryStore()
  const bus = new AppBus()
  const log = new Logger(store, bus)
  log.setLevel('error')
  const manager = new PrinterManager(store, bus, log)
  manager.setFastMode(true)
  const events: AppEvent[] = []
  bus.onEvent((e) => events.push(e))
  if (seed) manager.seedIfEmpty()
  return { store, bus, log, manager, events }
}
