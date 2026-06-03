<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Icon from './ui/Icon.vue'
import { useAppStore } from '../stores/app'
import { usePrintersStore } from '../stores/printers'

const route = useRoute()
const app = useAppStore()
const printers = usePrintersStore()

const nav = [
  { name: 'dashboard', label: 'Dashboard', icon: 'dashboard', to: '/' },
  { name: 'printers', label: 'Stampanti', icon: 'printer', to: '/printers' },
  { name: 'history', label: 'Storico', icon: 'history', to: '/history' },
  { name: 'monitor', label: 'Monitor Live', icon: 'monitor', to: '/monitor' },
  { name: 'simulations', label: 'Simulazioni', icon: 'zap', to: '/simulations' },
  { name: 'statistics', label: 'Statistiche', icon: 'chart', to: '/statistics' },
  { name: 'settings', label: 'Impostazioni', icon: 'settings', to: '/settings' },
  { name: 'system', label: 'Dashboard Sistema', icon: 'cpu', to: '/system' }
]

const onlineCount = computed(() => printers.online.length)
const qzUp = computed(() => app.servers.qz.running)
const apiUp = computed(() => app.servers.api.running)
</script>

<template>
  <aside class="w-64 shrink-0 h-full flex flex-col border-r border-white/[0.06] bg-ink-900/60 backdrop-blur-xl">
    <div class="px-5 py-5 flex items-center gap-3 drag">
      <div class="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-cyan-500 text-white shadow-glow">
        <Icon name="logo" :size="22" />
      </div>
      <div class="leading-tight">
        <p class="text-sm font-semibold text-white">Clicketta</p>
        <p class="text-[11px] text-slate-400">Thermal Simulator</p>
      </div>
    </div>

    <nav class="flex-1 px-3 space-y-1 overflow-y-auto no-drag">
      <RouterLink
        v-for="item in nav"
        :key="item.name"
        :to="item.to"
        class="nav-item"
        :class="{ 'nav-item-active': route.name === item.name }"
        :data-testid="`nav-${item.name}`"
      >
        <Icon :name="item.icon" :size="18" />
        <span class="flex-1">{{ item.label }}</span>
        <span
          v-if="item.name === 'monitor' && onlineCount"
          class="text-[10px] tabular-nums rounded-full px-1.5 py-0.5 bg-emerald-500/15 text-emerald-300"
          >{{ onlineCount }}</span
        >
      </RouterLink>
    </nav>

    <div class="p-3 mx-3 mb-3 glass-soft space-y-2">
      <div class="flex items-center justify-between text-xs">
        <span class="flex items-center gap-2 text-slate-400"><Icon name="wifi" :size="14" /> QZ Tray</span>
        <span :class="qzUp ? 'text-emerald-300' : 'text-slate-500'">{{ qzUp ? 'attivo' : 'spento' }}</span>
      </div>
      <div class="flex items-center justify-between text-xs">
        <span class="flex items-center gap-2 text-slate-400"><Icon name="server" :size="14" /> API</span>
        <span :class="apiUp ? 'text-emerald-300' : 'text-slate-500'">{{ apiUp ? `:${app.servers.api.port}` : 'spento' }}</span>
      </div>
    </div>
  </aside>
</template>
