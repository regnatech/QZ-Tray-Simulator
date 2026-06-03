<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{ values: number[]; accent?: string; width?: number; height?: number }>(),
  { accent: '#06b6d4', width: 120, height: 36 }
)

const path = computed(() => {
  const vals = props.values.length ? props.values : [0, 0]
  const max = Math.max(1, ...vals)
  const step = props.width / Math.max(1, vals.length - 1)
  return vals
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${(props.height - (v / max) * (props.height - 4) - 2).toFixed(1)}`)
    .join(' ')
})
const area = computed(() => `${path.value} L ${props.width} ${props.height} L 0 ${props.height} Z`)
const id = `spark-${Math.random().toString(36).slice(2, 8)}`
</script>

<template>
  <svg :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" class="overflow-visible">
    <defs>
      <linearGradient :id="id" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" :stop-color="accent" stop-opacity="0.35" />
        <stop offset="100%" :stop-color="accent" stop-opacity="0" />
      </linearGradient>
    </defs>
    <path :d="area" :fill="`url(#${id})`" />
    <path :d="path" fill="none" :stroke="accent" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</template>
