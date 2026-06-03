<script setup lang="ts">
import Icon from './ui/Icon.vue'
import { useAppStore } from '../stores/app'

const app = useAppStore()
const icon: Record<string, string> = { info: 'bell', success: 'check', warning: 'alert', error: 'alert' }
const color: Record<string, string> = {
  info: 'text-slate-200',
  success: 'text-emerald-300',
  warning: 'text-amber-300',
  error: 'text-red-300'
}
</script>

<template>
  <div class="fixed bottom-5 right-5 z-50 flex flex-col gap-2 w-80">
    <TransitionGroup name="toast">
      <div
        v-for="t in app.toasts"
        :key="t.id"
        class="glass px-4 py-3 flex items-center gap-3 animate-fade-in"
      >
        <Icon :name="icon[t.kind]" :size="18" :class="color[t.kind]" />
        <span class="text-sm text-slate-200 flex-1">{{ t.message }}</span>
        <button class="text-slate-500 hover:text-white" @click="app.dismiss(t.id)">
          <Icon name="x" :size="16" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(40px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(40px);
}
</style>
