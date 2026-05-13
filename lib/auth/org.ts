import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export const ORG_COOKIE = 'current_org'
export const ORG_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 30, // 30 days
  path: '/',
}

export type OrgMembership = {
  orgId: string
  orgName: string
  orgSlug: string
  role: string
}

export type OrgContext = {
  current: OrgMembership
  all: OrgMembership[]
}

type MembershipRow = {
  org_id: string
  role: string
  organizations: { id: string; name: string; slug: string } | null
}

/**
 * Returns the current org context for the authenticated user.
 * - Reads the current_org cookie to determine active org.
 * - If the cookie is missing and the user belongs to exactly one org,
 *   that org is returned (handles first-visit / cookie-cleared cases).
 * - Returns null if: not authenticated, no memberships, or the cookie
 *   refers to an org the user no longer belongs to.
 */
export async function getOrgContext(): Promise<OrgContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: rawRows } = await supabase
    .from('organization_members')
    .select('org_id, role, organizations(id, name, slug)')
    .eq('user_id', user.id)

  const rows = (rawRows ?? []) as unknown as MembershipRow[]
  if (rows.length === 0) return null

  const memberships: OrgMembership[] = rows.map((r) => ({
    orgId: r.org_id,
    orgName: r.organizations?.name ?? '',
    orgSlug: r.organizations?.slug ?? '',
    role: r.role,
  }))

  const cookieStore = await cookies()
  const currentOrgId = cookieStore.get(ORG_COOKIE)?.value

  if (!currentOrgId) {
    // No cookie: auto-select if there's only one org.
    if (memberships.length === 1) return { current: memberships[0], all: memberships }
    return null
  }

  const current = memberships.find((m) => m.orgId === currentOrgId)
  if (!current) return null // cookie is stale (removed from org)

  return { current, all: memberships }
}
