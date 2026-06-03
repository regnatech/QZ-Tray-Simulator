<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { PaperWidth, Printer, PrinterInput } from '@shared/types'
import Modal from './ui/Modal.vue'
import Icon from './ui/Icon.vue'

const props = defineProps<{ open: boolean; printer?: Printer | null }>()
const emit = defineEmits<{ close: []; save: [PrinterInput] }>()

const ICONS = ['printer', 'chef-hat', 'coffee', 'receipt', 'box', 'server', 'terminal']
const COLORS = ['#6366f1', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
const DRIVERS = ['Epson TM-T88V', 'Epson TM-T20III', 'Star TSP143', 'Star mC-Print3', 'Bixolon SRP-350', 'Generic ESC/POS']

const form = reactive<PrinterInput>(blank())

function blank(): PrinterInput {
  return {
    name: '',
    description: '',
    driver: 'Epson TM-T88V',
    language: 'ESC/POS',
    port: 'USB001',
    paperWidth: 80,
    identifier: '',
    enabled: true,
    color: '#6366f1',
    icon: 'printer'
  }
}

watch(
  () => props.open,
  (v) => {
    if (!v) return
    if (props.printer) {
      Object.assign(form, {
        name: props.printer.name,
        description: props.printer.description,
        driver: props.printer.driver,
        language: props.printer.language,
        port: props.printer.port,
        paperWidth: props.printer.paperWidth,
        identifier: props.printer.identifier,
        enabled: props.printer.enabled,
        color: props.printer.color,
        icon: props.printer.icon
      })
    } else {
      Object.assign(form, blank())
    }
  }
)

function submit(): void {
  if (!form.name.trim()) return
  if (!form.identifier.trim()) form.identifier = form.name.trim()
  emit('save', { ...form })
}
</script>

<template>
  <Modal :open="open" :title="printer ? 'Modifica stampante' : 'Nuova stampante virtuale'" wide @close="emit('close')">
    <form class="space-y-4" @submit.prevent="submit">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">Nome</label>
          <input v-model="form.name" class="input" placeholder="Cucina" data-testid="printer-name" />
        </div>
        <div>
          <label class="label">Identificativo (qz.printers.find)</label>
          <input v-model="form.identifier" class="input font-mono" placeholder="Cucina" data-testid="printer-identifier" />
        </div>
      </div>

      <div>
        <label class="label">Descrizione</label>
        <input v-model="form.description" class="input" placeholder="Stampante della cucina" />
      </div>

      <div class="grid grid-cols-3 gap-4">
        <div>
          <label class="label">Driver simulato</label>
          <select v-model="form.driver" class="input">
            <option v-for="d in DRIVERS" :key="d" :value="d">{{ d }}</option>
          </select>
        </div>
        <div>
          <label class="label">Porta</label>
          <input v-model="form.port" class="input font-mono" placeholder="USB001" />
        </div>
        <div>
          <label class="label">Larghezza carta</label>
          <select v-model.number="form.paperWidth" class="input">
            <option :value="58 as PaperWidth">58 mm</option>
            <option :value="80 as PaperWidth">80 mm</option>
          </select>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">Linguaggio</label>
          <select v-model="form.language" class="input">
            <option value="ESC/POS">ESC/POS</option>
            <option value="StarPRNT">StarPRNT</option>
          </select>
        </div>
        <div class="flex items-end gap-3">
          <label class="flex items-center gap-2 text-sm text-slate-300">
            <input v-model="form.enabled" type="checkbox" class="accent-brand-500 h-4 w-4" /> Attiva
          </label>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">Icona</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="ic in ICONS"
              :key="ic"
              type="button"
              class="grid h-9 w-9 place-items-center rounded-lg border transition"
              :class="form.icon === ic ? 'border-brand-500 bg-brand-500/15 text-brand-300' : 'border-white/10 text-slate-400 hover:text-white'"
              @click="form.icon = ic"
            >
              <Icon :name="ic" :size="18" />
            </button>
          </div>
        </div>
        <div>
          <label class="label">Colore</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="c in COLORS"
              :key="c"
              type="button"
              class="h-9 w-9 rounded-lg border-2 transition"
              :style="{ background: c }"
              :class="form.color === c ? 'border-white' : 'border-transparent opacity-70 hover:opacity-100'"
              @click="form.color = c"
            />
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-3 pt-2">
        <button type="button" class="btn-ghost" @click="emit('close')">Annulla</button>
        <button type="submit" class="btn-primary" data-testid="printer-save">
          <Icon name="check" :size="16" /> {{ printer ? 'Salva modifiche' : 'Crea stampante' }}
        </button>
      </div>
    </form>
  </Modal>
</template>
