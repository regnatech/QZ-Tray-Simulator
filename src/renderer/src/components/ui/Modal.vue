<script setup lang="ts">
import { watch } from 'vue'
import Icon from './Icon.vue'

const props = defineProps<{ open: boolean; title?: string; wide?: boolean }>()
const emit = defineEmits<{ close: [] }>()

watch(
  () => props.open,
  (v) => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') emit('close')
    }
    if (v) window.addEventListener('keydown', handler)
    else window.removeEventListener('keydown', handler)
  }
)
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-6">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="emit('close')" />
        <div
          class="glass relative w-full max-h-[88vh] overflow-y-auto p-6 animate-fade-in"
          :class="wide ? 'max-w-3xl' : 'max-w-lg'"
        >
          <div v-if="title" class="flex items-center justify-between mb-5">
            <h2 class="text-lg font-semibold text-white">{{ title }}</h2>
            <button class="text-slate-400 hover:text-white transition" @click="emit('close')">
              <Icon name="x" :size="20" />
            </button>
          </div>
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
