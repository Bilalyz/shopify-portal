'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { ORG_COOKIE, ORG_COOKIE_OPTIONS } from '@/lib/auth/org'

async function resolveOrgAfterLogin(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: rows } = await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)

  if (rows?.length === 1) return rows[0].org_id
  return null // 0 or 2+ orgs — let user pick on /orgs
}

export async function signIn(
  _prevState: { error: string } | undefined,
  formData: FormData
) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) {
    return { error: error.message }
  }

  const singleOrgId = await resolveOrgAfterLogin()
  if (singleOrgId) {
    const cookieStore = await cookies()
    cookieStore.set(ORG_COOKIE, singleOrgId, ORG_COOKIE_OPTIONS)
    redirect('/dashboard')
  }

  redirect('/orgs')
}

export async function signUp(
  _prevState: { error: string } | undefined,
  formData: FormData
) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) {
    return { error: error.message }
  }

  // New sign-ups won't have an org yet; send them to the picker.
  redirect('/orgs')
}

export async function signOut() {
  const supabase = await createClient()
  const cookieStore = await cookies()
  cookieStore.delete(ORG_COOKIE)
  await supabase.auth.signOut()
  redirect('/login')
}
