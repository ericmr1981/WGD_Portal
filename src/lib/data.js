import { supabase } from './supabase'
import { getSession } from './auth'
import configData from '../../data/config.json'

export function getConfig() {
  return configData
}

// ---- Apps ----

export async function getApps() {
  const { data, error } = await supabase.rpc('get_apps')
  if (error) {
    console.error('getApps error:', error)
    return []
  }
  return data || []
}

export async function upsertApp({ id, name, url, category, order, icon, description }) {
  const session = getSession()
  if (!session) return { success: false, error: '未登录' }

  const { data, error } = await supabase.rpc('admin_upsert_app', {
    admin_id: session.id,
    p_id: id || null,
    p_name: name,
    p_url: url,
    p_category: category,
    p_order: order,
    p_icon: icon || '',
    p_description: description || '',
  })

  if (error) return { success: false, error: error.message }
  return data
}

export async function deleteApp(appId) {
  const session = getSession()
  if (!session) return { success: false, error: '未登录' }

  const { data, error } = await supabase.rpc('admin_delete_app', {
    admin_id: session.id,
    app_id: appId,
  })

  if (error) return { success: false, error: error.message }
  return data
}

export async function reorderApps(appIds) {
  const session = getSession()
  if (!session) return { success: false, error: '未登录' }

  const { data, error } = await supabase.rpc('admin_reorder_apps', {
    admin_id: session.id,
    app_ids: appIds,
  })

  if (error) return { success: false, error: error.message }
  return data
}

// ---- Users ----

export async function getUsers() {
  const session = getSession()
  if (!session) return []

  const { data, error } = await supabase.rpc('admin_get_users', {
    admin_id: session.id,
  })

  if (error) return []
  if (!data?.success) return []
  return data.users || []
}

export async function createUser({ username, password, name, role }) {
  const session = getSession()
  if (!session) return { success: false }

  const { data, error } = await supabase.rpc('admin_create_user', {
    admin_id: session.id,
    p_username: username,
    p_password: password,
    p_name: name,
    p_role: role || 'user',
  })

  if (error) return { success: false, error: error.message }
  return data
}

export async function updateUser(id, { name, role }) {
  const session = getSession()
  if (!session) return { success: false }

  const { data, error } = await supabase.rpc('admin_update_user', {
    admin_id: session.id,
    target_id: id,
    p_name: name,
    p_role: role,
  })

  if (error) return { success: false, error: error.message }
  return data
}

export async function deleteUser(id) {
  const session = getSession()
  if (!session) return { success: false }

  const { data, error } = await supabase.rpc('admin_delete_user', {
    admin_id: session.id,
    target_id: id,
  })

  if (error) return { success: false, error: error.message }
  return data
}

export async function resetPassword(userId, newPassword) {
  const session = getSession()
  if (!session) return { success: false }

  const { data, error } = await supabase.rpc('admin_reset_password', {
    admin_id: session.id,
    target_id: userId,
    new_password: newPassword,
  })

  if (error) return { success: false, error: error.message }
  return data
}

// ---- Prompts ----

export async function getPrompts() {
  const { data, error } = await supabase.rpc('public_prompts')
  if (error) return []
  return data?.prompts || []
}

export async function adminGetPrompts() {
  const session = getSession()
  if (!session) return []
  const { data, error } = await supabase.rpc('admin_get_prompts')
  if (error) return []
  return data?.prompts || []
}

export async function adminUpsertPrompt({ id, icon, title, desc, prompt }) {
  const session = getSession()
  if (!session) return { success: false }
  const { data, error } = await supabase.rpc('admin_upsert_prompt', {
    p_id: id || null,
    p_icon: icon,
    p_title: title,
    p_desc: desc,
    p_prompt: prompt,
  })
  if (error) return { success: false, error: error.message }
  return data
}

export async function adminDeletePrompt(id) {
  const session = getSession()
  if (!session) return { success: false }
  const { data, error } = await supabase.rpc('admin_delete_prompt', { p_id: id })
  if (error) return { success: false, error: error.message }
  return data
}
