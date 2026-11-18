import type { AppSettings, ServerInfo, ServerKind } from '@shared/types'
import { AppBus } from './core/bus'
import { Logger } from './core/logger'
import type { Store } from './db/store'
import { PrinterManager } from './engine/printerManager'
import { TrafficSimulator } from './engine/trafficSimulator'
import { ApiServer } from './server/apiServer'
import { localAddresses, NetworkPrinterServer } from './server/networkServer'
import { QzServer } from './server/qzServer'

/** Owns every long-lived subsystem and the wiring between them. */
export class AppContext {
  readonly bus: AppBus
  readonly log: Logger
  readonly manager: PrinterManager
  readonly simulator: TrafficSimulator
  readonly api: ApiServer
  readonly qz: QzServer
  readonly network: NetworkPrinterServer

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
    this.network = new NetworkPrinterServer(this.manager, store, this.log, () => this.emitServers())
    // Printer edits (enable, port, host...) open/close their network listeners.
    this.bus.onEvent((e) => {
      if (e.type === 'printer:updated' || e.type === 'printer:removed') void this.network.sync()
    })
  }

  async init(): Promise<void> {
    const settings = this.store.getSettings()
    this.log.setLevel(settings.logLevel)
    this.manager.seedIfEmpty()
    this.log.info('app', 'Clicketta Thermal Simulator initialised')
    if (settings.autoStartServers) await this.startServers('all', settings)
  }

  async startServers(which: ServerKind, settings?: AppSettings): Promise<void> {
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
    if ((which === 'network' || which === 'all') && s.networkEnabled) await this.network.start()
    this.emitServers()
  }

  async stopServers(which: ServerKind): Promise<void> {
    if (which === 'api' || which === 'all') await this.api.stop()
    if (which === 'qz' || which === 'all') await this.qz.stop()
    if (which === 'network' || which === 'all') await this.network.stop()
    this.emitServers()
  }

  emitServers(): void {
    this.bus.emitEvent({ type: 'servers', info: this.serverInfo() })
  }

  serverInfo(): ServerInfo {
    const s = this.store.getSettings()
    return {
      api: { running: this.api.running, port: s.apiPort },
      qz: { running: this.qz.running, port: s.qzPort },
      network: {
        running: this.network.running,
        listeners: this.network.info(),
        addresses: localAddresses()
      }
    }
  }

  async dispose(): Promise<void> {
    this.simulator.stop()
    await this.stopServers('all')
    this.store.close()
  }
}
