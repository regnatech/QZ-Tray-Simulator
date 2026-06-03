/** Human "time ago" in Italian, compact. */
export function timeAgo(ts: number | null | undefined): string {
  if (!ts) return 'mai'
  const diff = Date.now() - ts
  const s = Math.floor(diff / 1000)
  if (s < 5) return 'ora'
  if (s < 60) return `${s} secondi fa`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} ${m === 1 ? 'minuto' : 'minuti'} fa`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ${h === 1 ? 'ora' : 'ore'} fa`
  const d = Math.floor(h / 24)
  return `${d} ${d === 1 ? 'giorno' : 'giorni'} fa`
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('it-IT')
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(2)} s`
}
