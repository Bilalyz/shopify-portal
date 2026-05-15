import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/auth/org'
import { signOut } from '@/app/actions/auth'
import OrgSwitcher from './_org-switcher'

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'super admin',
  owner: 'owner',
  admin: 'admin',
  operator: 'operator',
}

export default async function DashboardNav() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const orgContext = await getOrgContext()

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">

          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gray-900 rounded-md flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 9.5l2.5 1.5L12 6l7.5 5 2.5-1.5L12 2zm0 5L5 12l7 10 7-10-7-5z" />
              </svg>
            </div>
            {orgContext ? (
              <OrgSwitcher current={orgContext.current} all={orgContext.all} />
            ) : (
              <span className="font-semibold text-gray-900 tracking-tight text-sm">Portal</span>
            )}
          </Link>

          <div className="flex items-center gap-4">
            {orgContext && ['super_admin', 'owner', 'admin'].includes(orgContext.current.role) && (
              <Link
                href="/dashboard/settings"
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors duration-150"
              >
                Settings
              </Link>
            )}
            {user && (
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-xs text-gray-400 truncate max-w-44">{user.email}</span>
                {orgContext && (
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                    {ROLE_LABELS[orgContext.current.role] ?? orgContext.current.role}
                  </span>
                )}
              </div>
            )}
            <form action={signOut}>
              <button
                type="submit"
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors duration-150 cursor-pointer"
              >
                Sign out
              </button>
            </form>
          </div>

        </div>
      </div>
    </header>
  )
}
