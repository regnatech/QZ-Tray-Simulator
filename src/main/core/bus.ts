import { EventEmitter } from 'node:events'
import type { AppEvent } from '@shared/types'

/** Strongly-typed application event bus (main process internal). */
export class AppBus extends EventEmitter {
  emitEvent(event: AppEvent): void {
    this.emit('app', event)
  }
  onEvent(listener: (event: AppEvent) => void): () => void {
    this.on('app', listener)
    return () => this.off('app', listener)
  }
}

let counter = 0
/** Compact, sortable, collision-resistant id. */
export function genId(prefix = ''): string {
  counter = (counter + 1) % 0xffff
  const rand = Math.floor(Math.random() * 0xffffff).toString(16)
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}${rand}`
}
