import type { LogEntry, LogLevel } from '@shared/types'
import type { Store } from '../db/store'
import { AppBus, genId } from './bus'

const LEVEL_WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warning: 30, error: 40 }

/** Central logger: persists to the store, mirrors to stdout and the event bus. */
export class Logger {
  private minLevel: LogLevel = 'info'

  constructor(
    private store: Store,
    private bus: AppBus
  ) {}

  setLevel(level: LogLevel): void {
    this.minLevel = level
  }

  private write(level: LogLevel, scope: string, message: string, meta?: Record<string, unknown>): void {
    if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[this.minLevel]) return
    const entry: LogEntry = { id: genId('log_'), ts: Date.now(), level, scope, message, meta }
    try {
      this.store.addLog(entry)
    } catch {
      /* ignore persistence failures for logs */
    }
    this.bus.emitEvent({ type: 'log', entry })
    const line = `[${new Date(entry.ts).toISOString()}] ${level.toUpperCase()} (${scope}) ${message}`
    if (level === 'error') console.error(line)
    else if (level === 'warning') console.warn(line)
    else console.log(line)
  }

  debug(scope: string, message: string, meta?: Record<string, unknown>): void {
    this.write('debug', scope, message, meta)
  }
  info(scope: string, message: string, meta?: Record<string, unknown>): void {
    this.write('info', scope, message, meta)
  }
  warning(scope: string, message: string, meta?: Record<string, unknown>): void {
    this.write('warning', scope, message, meta)
  }
  error(scope: string, message: string, meta?: Record<string, unknown>): void {
    this.write('error', scope, message, meta)
  }
}
