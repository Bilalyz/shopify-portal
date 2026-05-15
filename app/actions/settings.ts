'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/auth/org'

export type ArrayField = 'tag_presets' | 'product_types' | 'size_options' | 'color_options'

const ADMIN_ROLES = ['super_admin', 'owner', 'admin']

async function requireAdminContext() {
  const supabase = await createClient()
  const orgContext = await getOrgContext()
  if (!orgContext) redirect('/orgs')
  if (!ADMIN_ROLES.includes(orgContext.current.role)) redirect('/dashboard')
  return { supabase, orgId: orgContext.current.orgId }
}

// Upsert the org_settings row if it doesn't exist yet
async function ensureOrgSettings(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string) {
  const { data } = await supabase
    .from('org_settings')
    .select('id')
    .eq('org_id', orgId)
    .single()

  if (!data) {
    await supabase.from('org_settings').insert({ org_id: orgId })
  }
}

// ── Org details ──────────────────────────────────────────────

export type OrgDetailsState = { error?: string; success?: boolean } | undefined

export async function updateOrgDetails(
  _prev: OrgDetailsState,
  formData: FormData
): Promise<OrgDetailsState> {
  const { supabase, orgId } = await requireAdminContext()

  const name = (formData.get('name') as string)?.trim()
  const defaultVendor = (formData.get('default_vendor') as string)?.trim() || null
  const language = formData.get('language') as string

  if (!name) return { error: 'Organization name is required' }
  if (!['he', 'en', 'ar'].includes(language)) return { error: 'Invalid language selection' }

  const { error } = await supabase
    .from('organizations')
    .update({ name, default_vendor: defaultVendor, language })
    .eq('id', orgId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard')
  return { success: true }
}

// ── Array field mutations ────────────────────────────────────

export async function addArrayItem(field: ArrayField, value: string): Promise<{ error?: string }> {
  const { supabase, orgId } = await requireAdminContext()

  const item = value.trim()
  if (!item) return { error: 'Value cannot be empty' }

  await ensureOrgSettings(supabase, orgId)

  const { data: settings, error: fetchErr } = await supabase
    .from('org_settings')
    .select('tag_presets, product_types, size_options, color_options')
    .eq('org_id', orgId)
    .single()

  if (fetchErr) return { error: fetchErr.message }

  const current = ((settings as Record<string, unknown>)[field] as string[]) ?? []
  if (current.includes(item)) return { error: 'Item already exists' }

  const { error } = await supabase
    .from('org_settings')
    .update({ [field]: [...current, item] })
    .eq('org_id', orgId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/settings')
  return {}
}

export async function removeArrayItem(field: ArrayField, value: string): Promise<{ error?: string }> {
  const { supabase, orgId } = await requireAdminContext()

  const { data: settings, error: fetchErr } = await supabase
    .from('org_settings')
    .select('tag_presets, product_types, size_options, color_options')
    .eq('org_id', orgId)
    .single()

  if (fetchErr || !settings) return { error: fetchErr?.message ?? 'Settings not found' }

  const current = ((settings as Record<string, unknown>)[field] as string[]) ?? []
  const updated = current.filter((v) => v !== value)

  const { error } = await supabase
    .from('org_settings')
    .update({ [field]: updated })
    .eq('org_id', orgId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/settings')
  return {}
}
