'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { ORG_COOKIE, ORG_COOKIE_OPTIONS } from '@/lib/auth/org'

export async function switchOrg(orgId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify the user is actually a member of the target org.
  const { data: membership } = await supabase
    .from('organization_members')
    .select('org_id')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .single()

  if (!membership) redirect('/orgs')

  const cookieStore = await cookies()
  cookieStore.set(ORG_COOKIE, orgId, ORG_COOKIE_OPTIONS)
  redirect('/dashboard')
}
