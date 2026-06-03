<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Printer, PrinterInput } from '@shared/types'
import PrinterCard from '../components/PrinterCard.vue'
import PrinterEditor from '../components/PrinterEditor.vue'
import ErrorSimulator from '../components/ErrorSimulator.vue'
import Modal from '../components/ui/Modal.vue'
import Icon from '../components/ui/Icon.vue'
import StatusBadge from '../components/ui/StatusBadge.vue'
import Toggle from '../components/ui/Toggle.vue'
import { usePrintersStore } from '../stores/printers'
import { useAppStore } from '../stores/app'
import { SAMPLES } from '../lib/samples'
import { api } from '../lib/api'

const printers = usePrintersStore()
const app = useAppStore()

const editorOpen = ref(false)
const editing = ref<Printer | null>(null)
const selectedId = ref<string | null>(null)
const confirmDelete = ref<Printer | null>(null)

const selected = computed(() => (selectedId.value ? printers.byId(selectedId.value) : null))

function openCreate(): void {
  editing.value = null
  editorOpen.value = true
}
function openEdit(p: Printer): void {
  editing.value = p
  editorOpen.value = true
}
async function save(input: PrinterInput): Promise<void> {
  if (editing.value) {
    await printers.update(editing.value.id, input)
    app.toast('success', 'Stampante aggiornata')
  } else {
    await printers.create(input)
    app.toast('success', 'Stampante creata')
  }
  editorOpen.value = false
}
async function doDelete(): Promise<void> {
  if (!confirmDelete.value) return
  const id = confirmDelete.value.id
  await printers.remove(id)
  if (selectedId.value === id) selectedId.value = null
  confirmDelete.value = null
  app.toast('info', 'Stampante eliminata')
}
async function duplicate(p: Printer): Promise<void> {
  await printers.duplicate(p.id)
  app.toast('success', 'Stampante duplicata')
}
async function toggleEnabled(p: Printer): Promise<void> {
  await printers.setEnabled(p.id, !p.enabled)
}
async function sendSample(sampleId: string): Promise<void> {
  const p = selected.value
  if (!p) return
  const sample = SAMPLES.find((s) => s.id === sampleId)
  if (!sample) return
  const data = sample.build(p.paperWidth)
  const res = await api.print(p.identifier, data, 'base64')
  if (res.ok) app.toast('success', `Stampa inviata a ${p.name}`)
  else app.toast('error', res.error ?? 'Stampa fallita')
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm text-slate-400">{{ printers.printers.length }} stampanti virtuali configurate</p>
      </div>
      <button class="btn-primary" data-testid="new-printer" @click="openCreate">
        <Icon name="plus" :size="16" /> Nuova stampante
      </button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div v-for="p in printers.printers" :key="p.id" class="relative group">
          <PrinterCard :printer="p" @open="selectedId = p.id" />
          <div class="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition" @click.stop>
            <button class="grid h-7 w-7 place-items-center rounded-md bg-ink-800/90 text-slate-300 hover:text-white" title="Modifica" @click="openEdit(p)">
              <Icon name="edit" :size="14" />
            </button>
            <button class="grid h-7 w-7 place-items-center rounded-md bg-ink-800/90 text-slate-300 hover:text-white" title="Duplica" @click="duplicate(p)">
              <Icon name="copy" :size="14" />
            </button>
            <button class="grid h-7 w-7 place-items-center rounded-md bg-ink-800/90 text-red-300 hover:text-red-200" title="Elimina" @click="confirmDelete = p">
              <Icon name="trash" :size="14" />
            </button>
          </div>
        </div>

        <button
          class="glass border-dashed border-white/10 grid place-items-center min-h-[220px] text-slate-500 hover:text-brand-300 hover:border-brand-500/40 transition"
          @click="openCreate"
        >
          <div class="text-center">
            <Icon name="plus" :size="28" class="mx-auto mb-2" />
            <p class="text-sm">Aggiungi stampante</p>
          </div>
        </button>
      </div>

      <div class="space-y-4">
        <div v-if="selected" class="glass p-5 space-y-4 animate-fade-in">
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-3">
              <div class="grid h-11 w-11 place-items-center rounded-xl" :style="{ background: `${selected.color}22`, color: selected.color }">
                <Icon :name="selected.icon" :size="22" />
              </div>
              <div>
                <p class="font-semibold text-white">{{ selected.name }}</p>
                <p class="text-xs text-slate-500">{{ selected.description || selected.driver }}</p>
              </div>
            </div>
            <StatusBadge :status="selected.status" />
          </div>

          <dl class="grid grid-cols-2 gap-2 text-sm">
            <div class="glass-soft px-3 py-2"><dt class="text-[10px] text-slate-500 uppercase">Driver</dt><dd class="text-slate-200">{{ selected.driver }}</dd></div>
            <div class="glass-soft px-3 py-2"><dt class="text-[10px] text-slate-500 uppercase">Porta</dt><dd class="text-slate-200 font-mono">{{ selected.port }}</dd></div>
            <div class="glass-soft px-3 py-2"><dt class="text-[10px] text-slate-500 uppercase">Identificativo</dt><dd class="text-slate-200 font-mono">{{ selected.identifier }}</dd></div>
            <div class="glass-soft px-3 py-2"><dt class="text-[10px] text-slate-500 uppercase">Carta</dt><dd class="text-slate-200">{{ selected.paperWidth }}mm · {{ Math.round(selected.paperLevel) }}%</dd></div>
          </dl>

          <div class="flex items-center justify-between glass-soft px-3 py-2">
            <span class="text-sm text-slate-300">Stampante attiva</span>
            <Toggle :model-value="selected.enabled" @update:model-value="toggleEnabled(selected)" />
          </div>

          <div>
            <p class="text-sm font-medium text-slate-300 mb-2">Stampa di prova</p>
            <div class="grid grid-cols-1 gap-2">
              <button
                v-for="s in SAMPLES"
                :key="s.id"
                class="btn-ghost justify-start"
                :data-testid="`sample-${s.id}`"
                @click="sendSample(s.id)"
              >
                <Icon :name="s.icon" :size="16" /> {{ s.label }}
              </button>
            </div>
          </div>

          <div class="border-t border-white/5 pt-4">
            <ErrorSimulator :printer-id="selected.id" />
          </div>
        </div>

        <div v-else class="glass p-8 text-center text-slate-500">
          <Icon name="printer" :size="32" class="mx-auto mb-3 opacity-40" />
          <p class="text-sm">Seleziona una stampante per i dettagli, le stampe di prova e la simulazione errori.</p>
        </div>
      </div>
    </div>

    <PrinterEditor :open="editorOpen" :printer="editing" @close="editorOpen = false" @save="save" />

    <Modal :open="!!confirmDelete" title="Elimina stampante" @close="confirmDelete = null">
      <p class="text-sm text-slate-300">
        Eliminare definitivamente <strong class="text-white">{{ confirmDelete?.name }}</strong>? L'operazione non è reversibile.
      </p>
      <div class="flex justify-end gap-3 mt-6">
        <button class="btn-ghost" @click="confirmDelete = null">Annulla</button>
        <button class="btn-danger" data-testid="confirm-delete" @click="doDelete">
          <Icon name="trash" :size="16" /> Elimina
        </button>
      </div>
    </Modal>
  </div>
</template>
