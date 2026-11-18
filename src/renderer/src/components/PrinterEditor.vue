<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { PaperWidth, Printer, PrinterInput } from '@shared/types'
import Modal from './ui/Modal.vue'
import Icon from './ui/Icon.vue'
import Toggle from './ui/Toggle.vue'
import { usePrintersStore } from '../stores/printers'
import { useAppStore } from '../stores/app'

const props = defineProps<{ open: boolean; printer?: Printer | null }>()
const emit = defineEmits<{ close: []; save: [PrinterInput] }>()

const ICONS = ['printer', 'chef-hat', 'coffee', 'receipt', 'box', 'server', 'terminal']
const COLORS = ['#6366f1', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
const DRIVERS = ['Epson TM-T88V', 'Epson TM-T20III', 'Star TSP143', 'Star mC-Print3', 'Bixolon SRP-350', 'Generic ESC/POS']

const printers = usePrintersStore()
const app = useAppStore()

type Form = PrinterInput & Required<Pick<PrinterInput, 'networkEnabled' | 'networkHost' | 'networkPort'>>
const form = reactive<Form>(blank())

/** First port from 9100 upwards not used by another printer. */
function nextNetworkPort(): number {
  const used = new Set(printers.printers.map((p) => p.networkPort))
  let port = 9100
  while (used.has(port)) port++
  return port
}

const portClash = computed(() =>
  printers.printers.find(
    (p) => p.id !== props.printer?.id && p.networkEnabled && form.networkEnabled && p.networkPort === form.networkPort
  )
)

function blank(): Form {
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
    icon: 'printer',
    networkEnabled: true,
    networkHost: '0.0.0.0',
    networkPort: nextNetworkPort()
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
        icon: props.printer.icon,
        networkEnabled: props.printer.networkEnabled,
        networkHost: props.printer.networkHost,
        networkPort: props.printer.networkPort
      })
    } else {
      Object.assign(form, blank())
    }
  }
)

function submit(): void {
  if (!form.name.trim()) return
  if (!form.identifier.trim()) form.identifier = form.name.trim()
  if (!Number.isInteger(form.networkPort) || form.networkPort < 1 || form.networkPort > 65535) return
  form.networkHost = form.networkHost.trim() || '0.0.0.0'
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

      <div class="glass-soft p-4 space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-white flex items-center gap-2"><Icon name="wifi" :size="15" /> Stampante di rete</p>
            <p class="text-xs text-slate-500">RAW TCP / JetDirect: il gestionale stampa direttamente su IP e porta</p>
          </div>
          <Toggle v-model="form.networkEnabled" data-testid="printer-network-enabled" />
        </div>
        <div v-if="form.networkEnabled" class="grid grid-cols-3 gap-4">
          <div class="col-span-2">
            <label class="label">Indirizzo di ascolto</label>
            <select v-model="form.networkHost" class="input font-mono">
              <option value="0.0.0.0">0.0.0.0 (tutte le interfacce, raggiungibile in LAN)</option>
              <option value="127.0.0.1">127.0.0.1 (solo questo PC)</option>
              <option v-for="a in app.servers.network.addresses" :key="a" :value="a">{{ a }}</option>
              <option
                v-if="!['0.0.0.0', '127.0.0.1', ...app.servers.network.addresses].includes(form.networkHost)"
                :value="form.networkHost"
              >
                {{ form.networkHost }}
              </option>
            </select>
          </div>
          <div>
            <label class="label">Porta TCP</label>
            <input
              v-model.number="form.networkPort"
              type="number"
              min="1"
              max="65535"
              class="input font-mono"
              data-testid="printer-network-port"
            />
          </div>
          <p v-if="portClash" class="col-span-3 text-xs text-amber-300 flex items-center gap-1.5">
            <Icon name="alert" :size="13" /> Porta già usata da "{{ portClash.name }}": solo una delle due resterà in ascolto.
          </p>
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
