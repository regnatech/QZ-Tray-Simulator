import type { ClickettaApi } from '@shared/ipc'

declare global {
  interface Window {
    clicketta: ClickettaApi
  }
}

export {}
