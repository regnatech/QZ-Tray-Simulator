<script setup lang="ts">
import { computed } from 'vue'
import type { RenderNode } from '@shared/types'
import { parseRendered } from '../lib/receipt'

const props = defineProps<{ rawBase64: string; rendered: string }>()

const bytes = computed(() => {
  try {
    const bin = atob(props.rawBase64)
    return Uint8Array.from(bin, (c) => c.charCodeAt(0))
  } catch {
    return new Uint8Array()
  }
})

const hex = computed(() => {
  const rows: string[] = []
  const b = bytes.value
  for (let i = 0; i < b.length; i += 16) {
    const slice = b.slice(i, i + 16)
    const hexPart = [...slice].map((x) => x.toString(16).padStart(2, '0')).join(' ')
    const ascii = [...slice].map((x) => (x >= 0x20 && x <= 0x7e ? String.fromCharCode(x) : '·')).join('')
    rows.push(`${i.toString(16).padStart(6, '0')}  ${hexPart.padEnd(47, ' ')}  ${ascii}`)
  }
  return rows.join('\n')
})

const doc = computed(() => parseRendered(props.rendered))

function describe(node: RenderNode): { tag: string; detail: string; color: string } {
  switch (node.type) {
    case 'text': {
      const s = node.style
      const flags = [s.bold && 'B', s.underline && 'U', s.doubleWidth && '2W', s.doubleHeight && '2H', s.invert && 'INV', s.font === 'B' && 'FB']
        .filter(Boolean)
        .join(' ')
      return { tag: `TEXT ${s.align}`, detail: `${flags ? `[${flags}] ` : ''}${node.text.replace(/\n/g, '⏎').slice(0, 60)}`, color: '#818cf8' }
    }
    case 'barcode':
      return { tag: 'GS k', detail: `${node.symbology}: ${node.data}`, color: '#f59e0b' }
    case 'qrcode':
      return { tag: 'GS ( k', detail: `QR (size ${node.size}): ${node.data}`, color: '#22c55e' }
    case 'image':
      return { tag: 'GS v 0', detail: `Raster ${node.width}×${node.height}`, color: '#06b6d4' }
    case 'rule':
      return { tag: 'RULE', detail: 'separatore', color: '#64748b' }
    case 'feed':
      return { tag: 'ESC d', detail: `feed ${node.lines} righe`, color: '#64748b' }
    case 'cut':
      return { tag: 'GS V', detail: node.partial ? 'taglio parziale' : 'taglio completo', color: '#ef4444' }
    case 'drawer':
      return { tag: 'ESC p', detail: 'apertura cassetto', color: '#ec4899' }
    case 'beep':
      return { tag: 'ESC B', detail: `beep ×${node.count}`, color: '#8b5cf6' }
    default:
      return { tag: 'UNK', detail: '', color: '#64748b' }
  }
}
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <div>
      <p class="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Comandi interpretati ({{ doc?.nodes.length ?? 0 }})</p>
      <div class="glass-soft p-3 max-h-80 overflow-y-auto space-y-1">
        <div v-for="(node, i) in doc?.nodes ?? []" :key="i" class="flex items-start gap-2 text-xs">
          <span class="font-mono px-1.5 py-0.5 rounded shrink-0" :style="{ background: `${describe(node).color}22`, color: describe(node).color }">
            {{ describe(node).tag }}
          </span>
          <span class="text-slate-300 font-mono break-all">{{ describe(node).detail }}</span>
        </div>
      </div>
    </div>
    <div>
      <p class="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Hex dump ({{ bytes.length }} byte)</p>
      <pre class="glass-soft p-3 max-h-80 overflow-auto text-[11px] leading-relaxed font-mono text-slate-400">{{ hex }}</pre>
    </div>
  </div>
</template>
