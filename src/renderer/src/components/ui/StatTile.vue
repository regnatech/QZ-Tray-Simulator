<script setup lang="ts">
import Icon from './Icon.vue'

defineProps<{
  label: string
  value: string | number
  icon: string
  accent?: string
  hint?: string
}>()
</script>

<template>
  <div class="glass p-5 card-hover animate-fade-in">
    <div class="flex items-start justify-between">
      <div>
        <p class="text-xs font-medium text-slate-400 uppercase tracking-wide">{{ label }}</p>
        <p class="mt-2 text-3xl font-semibold text-white tabular-nums">{{ value }}</p>
        <p v-if="hint" class="mt-1 text-xs text-slate-500">{{ hint }}</p>
      </div>
      <div
        class="grid h-10 w-10 place-items-center rounded-xl"
        :style="{ background: `${accent ?? '#6366f1'}1f`, color: accent ?? '#818cf8' }"
      >
        <Icon :name="icon" :size="20" />
      </div>
    </div>
  </div>
</template>
