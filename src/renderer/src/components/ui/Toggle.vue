<script setup lang="ts">
const props = defineProps<{ modelValue: boolean; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()
function toggle(): void {
  if (!props.disabled) emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :disabled="disabled"
    class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 disabled:opacity-40"
    :class="modelValue ? 'bg-brand-500' : 'bg-ink-600'"
    @click="toggle"
  >
    <span
      class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200"
      :class="modelValue ? 'translate-x-6' : 'translate-x-1'"
    />
  </button>
</template>
