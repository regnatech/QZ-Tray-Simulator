import type { AppSettings } from '@shared/types'
import { AppBus } from './core/bus'
import { Logger } from './core/logger'
import type { Store } from './db/store'
import { PrinterManager } from './engine/printerManager'
import { TrafficSimulator } from './engine/trafficSimulator'
import { ApiServer } from './server/apiServer'
import { QzServer } from './server/qzServer'

/** Owns every long-lived subsystem and the wiring between them. */
export class AppContext {
  readonly bus: AppBus
  readonly log: Logger
  readonly manager: PrinterManager
  readonly simulator: TrafficSimulator
  readonly api: ApiServer
  readonly qz: QzServer

  constructor(
    readonly store: Store,
    readonly dbPath: string
  ) {
    this.bus = new AppBus()
    this.log = new Logger(store, this.bus)
    this.manager = new PrinterManager(store, this.bus, this.log)
    this.simulator = new TrafficSimulator(this.manager, this.bus, this.log)
    this.api = new ApiServer({ manager: this.manager, store, log: this.log }, this.log)
    this.qz = new QzServer(this.manager, this.log)
  }

  async init(): Promise<void> {
    const settings = this.store.getSettings()
    this.log.setLevel(settings.logLevel)
    this.manager.seedIfEmpty()
    this.log.info('app', 'Clicketta Thermal Simulator initialised')
    if (settings.autoStartServers) await this.startServers('all', settings)
  }

  async startServers(which: 'api' | 'qz' | 'all', settings?: AppSettings): Promise<void> {
    const s = settings ?? this.store.getSettings()
    if ((which === 'api' || which === 'all') && s.apiEnabled) {
      try {
        await this.api.start(s.apiPort)
      } catch (err) {
        this.log.error('app', `Failed to start API server: ${(err as Error).message}`)
      }
    }
    if ((which === 'qz' || which === 'all') && s.qzEnabled) {
      try {
        await this.qz.start(s.qzPort)
      } catch (err) {
        this.log.error('app', `Failed to start QZ server: ${(err as Error).message}`)
      }
    }
    this.emitServers()
  }

  async stopServers(which: 'api' | 'qz' | 'all'): Promise<void> {
    if (which === 'api' || which === 'all') await this.api.stop()
    if (which === 'qz' || which === 'all') await this.qz.stop()
    this.emitServers()
  }

  emitServers(): void {
    const s = this.store.getSettings()
    this.bus.emitEvent({
      type: 'servers',
      info: {
        api: { running: this.api.running, port: s.apiPort },
        qz: { running: this.qz.running, port: s.qzPort }
      }
    })
  }

  serverInfo() {
    const s = this.store.getSettings()
    return {
      api: { running: this.api.running, port: s.apiPort },
      qz: { running: this.qz.running, port: s.qzPort }
    }
  }

  async dispose(): Promise<void> {
    this.simulator.stop()
    await this.stopServers('all')
    this.store.close()
  }
}
