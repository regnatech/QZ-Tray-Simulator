import type { SimulationState, TrafficRate } from '@shared/types'
import { sampleReceipt } from '../escpos/builder'
import type { PrinterManager } from './printerManager'
import { AppBus } from '../core/bus'
import type { Logger } from '../core/logger'

/** Generates automated print traffic for stress-testing the simulator. */
export class TrafficSimulator {
  private timer: ReturnType<typeof setInterval> | null = null
  private state: SimulationState = {
    running: false,
    rate: 10,
    printerIds: [],
    generated: 0,
    startedAt: null
  }

  constructor(
    private manager: PrinterManager,
    private bus: AppBus,
    private log: Logger
  ) {}

  getState(): SimulationState {
    return { ...this.state }
  }

  start(rate: TrafficRate, printerIds: string[]): SimulationState {
    this.stop()
    const targets =
      printerIds.length > 0
        ? printerIds
        : this.manager.listPrinters().filter((p) => p.enabled).map((p) => p.id)
    if (targets.length === 0) {
      this.log.warning('simulation', 'No enabled printers to target')
      return this.getState()
    }

    this.state = { running: true, rate, printerIds: targets, generated: 0, startedAt: Date.now() }
    // Spread the per-minute rate across ticks; cap tick frequency for stability.
    const perSecond = rate / 60
    const intervalMs = Math.max(20, Math.round(1000 / Math.min(perSecond, 50)))
    const perTick = Math.max(1, Math.round((perSecond * intervalMs) / 1000))

    let cursor = 0
    this.timer = setInterval(() => {
      for (let k = 0; k < perTick; k++) {
        const printer = this.manager.listPrinters().find((p) => p.id === targets[cursor % targets.length])
        cursor++
        if (!printer) continue
        const bytes = sampleReceipt(Date.now() + cursor)
        void this.manager.submitPrint(printer.identifier, bytes, { source: 'simulation' })
        this.state.generated += 1
      }
      this.bus.emitEvent({ type: 'simulation', state: this.getState() })
    }, intervalMs)

    this.log.info('simulation', `Started traffic at ${rate}/min on ${targets.length} printer(s)`)
    this.bus.emitEvent({ type: 'simulation', state: this.getState() })
    return this.getState()
  }

  stop(): SimulationState {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    if (this.state.running) this.log.info('simulation', `Stopped traffic (generated ${this.state.generated})`)
    this.state = { ...this.state, running: false, startedAt: null }
    this.bus.emitEvent({ type: 'simulation', state: this.getState() })
    return this.getState()
  }
}
