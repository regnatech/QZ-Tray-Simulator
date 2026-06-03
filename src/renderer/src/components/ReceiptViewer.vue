<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { PaperWidth, RenderNode, TextStyle } from '@shared/types'
import { barcodeSvg, parseRendered, qrDataUrl } from '../lib/receipt'

const props = withDefaults(
  defineProps<{ rendered?: string | null; paperWidth?: PaperWidth; animate?: boolean }>(),
  { rendered: null, paperWidth: 80, animate: true }
)

interface Segment {
  text: string
  style: TextStyle
}
type Block =
  | { kind: 'line'; segments: Segment[]; align: TextStyle['align'] }
  | { kind: 'node'; node: RenderNode; key: string }

const doc = computed(() => (props.rendered ? parseRendered(props.rendered) : null))
const columns = computed(() => doc.value?.columns ?? (props.paperWidth === 58 ? 32 : 48))

/** Group the flat node stream into visual lines + standalone block nodes. */
const blocks = computed<Block[]>(() => {
  const out: Block[] = []
  if (!doc.value) return out
  let current: Segment[] = []
  let nodeKey = 0

  const flush = (): void => {
    if (current.length === 0) {
      out.push({ kind: 'line', segments: [{ text: '', style: baseStyle() }], align: 'left' })
      return
    }
    const align = current.find((s) => s.text.trim())?.style.align ?? 'left'
    out.push({ kind: 'line', segments: current, align })
    current = []
  }

  for (const node of doc.value.nodes) {
    if (node.type === 'text') {
      const parts = node.text.split('\n')
      parts.forEach((part, idx) => {
        if (idx > 0) flush()
        if (part.length) current.push({ text: part, style: node.style })
      })
    } else {
      if (current.length) flush()
      out.push({ kind: 'node', node, key: `n${nodeKey++}` })
    }
  }
  if (current.length) flush()
  return out
})

function baseStyle(): TextStyle {
  return {
    bold: false,
    underline: false,
    doubleWidth: false,
    doubleHeight: false,
    invert: false,
    align: 'left',
    font: 'A'
  }
}

function segStyle(s: TextStyle): Record<string, string> {
  const style: Record<string, string> = {}
  if (s.doubleHeight) style.fontSize = '1.7em'
  if (s.doubleWidth) {
    style.display = 'inline-block'
    style.transform = 'scaleX(1.7)'
    style.transformOrigin = 'center'
    style.margin = '0 0.35em'
  }
  if (s.font === 'B') style.fontSize = s.doubleHeight ? '1.5em' : '0.85em'
  return style
}
function segClass(s: TextStyle): string {
  return [
    s.bold ? 'font-bold' : '',
    s.underline ? 'underline' : '',
    s.invert ? 'bg-black text-[#f7f6f2] px-1' : ''
  ].join(' ')
}
const alignClass = (a: string): string =>
  a === 'center' ? 'justify-center text-center' : a === 'right' ? 'justify-end text-right' : 'justify-start'

/* ---- async QR / barcode generation ---- */
const qrCache = ref<Record<string, string>>({})
const barcodeCache = ref<Record<string, string>>({})

watch(
  blocks,
  async () => {
    for (const b of blocks.value) {
      if (b.kind !== 'node') continue
      if (b.node.type === 'qrcode') {
        const key = `${b.node.data}|${b.node.size}`
        if (!qrCache.value[key]) qrCache.value = { ...qrCache.value, [key]: await qrDataUrl(b.node.data, b.node.size) }
      } else if (b.node.type === 'barcode') {
        const key = `${b.node.symbology}|${b.node.data}|${b.node.hri}`
        if (!barcodeCache.value[key])
          barcodeCache.value = { ...barcodeCache.value, [key]: barcodeSvg(b.node.data, b.node.symbology, b.node.hri) }
      }
    }
  },
  { immediate: true }
)

const qrFor = (data: string, size: number): string => qrCache.value[`${data}|${size}`] ?? ''
const barcodeFor = (data: string, sym: string, hri: boolean): string =>
  barcodeCache.value[`${sym}|${data}|${hri}`] ?? ''

const paperStyle = computed(() => ({ width: `calc(${columns.value}ch + 2.5rem)` }))

function imageDataUrl(node: Extract<RenderNode, { type: 'image' }>): string {
  const canvas = document.createElement('canvas')
  canvas.width = node.width
  canvas.height = node.height
  const cx = canvas.getContext('2d')
  if (!cx) return ''
  const img = cx.createImageData(node.width, node.height)
  for (let i = 0; i < node.pixels.length; i++) {
    const on = node.pixels[i] === 1
    img.data[i * 4] = on ? 17 : 247
    img.data[i * 4 + 1] = on ? 17 : 246
    img.data[i * 4 + 2] = on ? 17 : 242
    img.data[i * 4 + 3] = 255
  }
  cx.putImageData(img, 0, 0)
  return canvas.toDataURL()
}
</script>

<template>
  <div class="flex justify-center">
    <div
      v-if="doc"
      class="thermal-paper relative font-thermal text-[12px] leading-[1.45] px-5 py-6 text-black"
      :class="animate ? 'animate-paper-feed' : ''"
      :style="paperStyle"
      data-testid="receipt"
    >
      <template v-for="(block, i) in blocks" :key="i">
        <div v-if="block.kind === 'line'" class="flex items-baseline whitespace-pre-wrap break-words" :class="alignClass(block.align)">
          <span
            v-for="(seg, si) in block.segments"
            :key="si"
            :class="segClass(seg.style)"
            :style="segStyle(seg.style)"
            >{{ seg.text }}</span
          >
        </div>

        <div v-else-if="block.node.type === 'rule'" class="my-1 border-t border-dashed border-black/40" />

        <div v-else-if="block.node.type === 'feed'" :style="{ height: `${Math.max(0, block.node.lines) * 0.9}em` }" />

        <div v-else-if="block.node.type === 'qrcode'" class="flex justify-center my-2">
          <img v-if="qrFor(block.node.data, block.node.size)" :src="qrFor(block.node.data, block.node.size)" alt="QR" class="w-28 h-28" />
        </div>

        <div v-else-if="block.node.type === 'barcode'" class="flex justify-center my-2" v-html="barcodeFor(block.node.data, block.node.symbology, block.node.hri)" />

        <div v-else-if="block.node.type === 'image'" class="flex justify-center my-2">
          <img :src="imageDataUrl(block.node)" alt="raster" class="max-w-full image-render-pixel" />
        </div>

        <div v-else-if="block.node.type === 'cut'" class="my-2 flex items-center gap-2 text-black/40">
          <span class="flex-1 border-t border-dashed border-black/30" />
          <span class="text-[10px]">✂ {{ block.node.partial ? 'taglio parziale' : 'taglio' }}</span>
          <span class="flex-1 border-t border-dashed border-black/30" />
        </div>
      </template>
    </div>

    <div v-else class="text-center text-slate-500 py-16 text-sm">
      Nessuno scontrino da visualizzare
    </div>
  </div>
</template>

<style scoped>
.image-render-pixel {
  image-rendering: pixelated;
}
</style>
