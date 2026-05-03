import appsData from '../../data/apps.json'
import configData from '../../data/config.json'

export function getConfig() {
  return configData
}

export function loadApps() {
  try {
    const local = localStorage.getItem('wgd_apps_override')
    if (local) {
      const overrides = JSON.parse(local)
      return appsData.map(a => {
        const override = overrides.find(o => o.id === a.id)
        return override ? { ...a, ...override } : a
      }).concat(
        overrides.filter(o => !appsData.find(a => a.id === o.id))
      )
    }
  } catch {}
  return appsData
}

function saveApps(apps) {
  localStorage.setItem('wgd_apps_override', JSON.stringify(apps))
}

export function addApp(app) {
  const apps = loadApps()
  apps.push(app)
  saveApps(apps)
  return apps
}

export function updateApp(id, updates) {
  const apps = loadApps()
  const idx = apps.findIndex(a => a.id === id)
  if (idx === -1) return apps
  apps[idx] = { ...apps[idx], ...updates }
  saveApps(apps)
  return apps
}

export function deleteApp(id) {
  let apps = loadApps()
  apps = apps.filter(a => a.id !== id)
  saveApps(apps)
  return apps
}

export function reorderApps(ids) {
  const apps = loadApps()
  const sorted = ids.map((id, i) => {
    const app = apps.find(a => a.id === id)
    if (app) return { ...app, order: i + 1 }
    return null
  }).filter(Boolean)
  saveApps(sorted)
  return sorted
}

export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
