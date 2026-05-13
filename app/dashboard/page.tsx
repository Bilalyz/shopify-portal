import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/actions/auth'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <main style={{ maxWidth: 600, margin: '80px auto', padding: '0 16px' }}>
      <h1>Dashboard</h1>
      <p>Welcome, {user.email}</p>
      <form action={signOut} style={{ marginTop: 24 }}>
        <button type="submit" style={{ padding: '8px 16px' }}>
          Sign out
        </button>
      </form>
    </main>
  )
}
