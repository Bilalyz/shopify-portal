import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/actions/auth'

export default async function DashboardNav() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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
            <span className="font-semibold text-gray-900 tracking-tight text-sm">Mona Moda Style</span>
          </Link>

          <div className="flex items-center gap-5">
            {user && (
              <span className="text-xs text-gray-400 hidden sm:block truncate max-w-48">
                {user.email}
              </span>
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
