import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { switchOrg } from '@/app/actions/orgs'
import { signOut } from '@/app/actions/auth'

type MembershipRow = {
  org_id: string
  role: string
  organizations: { id: string; name: string; slug: string } | null
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super admin',
  owner: 'Owner',
  admin: 'Admin',
  operator: 'Operator',
}

export default async function OrgsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawRows } = await supabase
    .from('organization_members')
    .select('org_id, role, organizations(id, name, slug)')
    .eq('user_id', user.id)

  const rows = (rawRows ?? []) as unknown as MembershipRow[]

  if (rows.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center mb-6">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 9.5l2.5 1.5L12 6l7.5 5 2.5-1.5L12 2zm0 5L5 12l7 10 7-10-7-5z" />
          </svg>
        </div>
        <h1 className="text-lg font-semibold text-gray-900 mb-2">No organizations</h1>
        <p className="text-sm text-gray-500 mb-6 text-center max-w-xs">
          Your account isn&apos;t linked to any organization yet. Contact your administrator.
        </p>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors duration-150 cursor-pointer"
          >
            Sign out
          </button>
        </form>
      </div>
    )
  }

  const memberships = rows.map((r) => ({
    orgId: r.org_id,
    orgName: r.organizations?.name ?? '',
    orgSlug: r.organizations?.slug ?? '',
    role: r.role,
  }))

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      {/* Brand mark */}
      <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center mb-6">
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L2 9.5l2.5 1.5L12 6l7.5 5 2.5-1.5L12 2zm0 5L5 12l7 10 7-10-7-5z" />
        </svg>
      </div>

      <h1 className="text-lg font-semibold text-gray-900 mb-1">Select organization</h1>
      <p className="text-sm text-gray-500 mb-8">
        {memberships.length === 1
          ? 'Continue to your organization.'
          : 'Choose which organization to work in.'}
      </p>

      <div className="w-full max-w-sm space-y-2">
        {memberships.map((m) => (
          <form key={m.orgId} action={switchOrg.bind(null, m.orgId)}>
            <button
              type="submit"
              className="w-full flex items-center justify-between gap-4 px-5 py-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-colors duration-150 cursor-pointer text-left group"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{m.orgName}</p>
                <p className="text-xs text-gray-400 mt-0.5">{ROLE_LABELS[m.role] ?? m.role}</p>
              </div>
              <svg
                className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors duration-150 shrink-0"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </form>
        ))}
      </div>

      <div className="mt-8">
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-gray-400 hover:text-gray-700 transition-colors duration-150 cursor-pointer"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}
