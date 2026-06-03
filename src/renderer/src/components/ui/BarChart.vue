<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{ data: Array<{ label: string; value: number }>; accent?: string; height?: number }>(),
  { accent: '#6366f1', height: 180 }
)

const max = computed(() => Math.max(1, ...props.data.map((d) => d.value)))
</script>

<template>
  <div class="flex items-end gap-1.5" :style="{ height: `${height}px` }">
    <div v-for="(d, i) in data" :key="i" class="group flex-1 flex flex-col items-center justify-end gap-1.5 h-full">
      <div class="relative w-full flex items-end justify-center h-full">
        <div
          class="w-full max-w-[26px] rounded-t-md transition-all duration-500 group-hover:opacity-100 opacity-85"
          :style="{
            height: `${(d.value / max) * 100}%`,
            minHeight: d.value > 0 ? '4px' : '0',
            background: `linear-gradient(180deg, ${accent}, ${accent}55)`
          }"
        >
          <span class="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-slate-300 opacity-0 group-hover:opacity-100 transition tabular-nums">{{ d.value }}</span>
        </div>
      </div>
      <span class="text-[10px] text-slate-500 truncate w-full text-center">{{ d.label }}</span>
    </div>
  </div>
</template>
