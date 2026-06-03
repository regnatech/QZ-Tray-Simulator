import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'dashboard', component: () => import('../views/DashboardView.vue') },
  { path: '/printers', name: 'printers', component: () => import('../views/PrintersView.vue') },
  { path: '/history', name: 'history', component: () => import('../views/HistoryView.vue') },
  { path: '/monitor', name: 'monitor', component: () => import('../views/MonitorView.vue') },
  { path: '/simulations', name: 'simulations', component: () => import('../views/SimulationsView.vue') },
  { path: '/statistics', name: 'statistics', component: () => import('../views/StatisticsView.vue') },
  { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue') },
  { path: '/system', name: 'system', component: () => import('../views/SystemView.vue') }
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes
})
