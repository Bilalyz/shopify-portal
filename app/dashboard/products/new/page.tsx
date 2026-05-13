import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import NewProductForm from './_form'

export default async function NewProductPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <main style={{ maxWidth: 640, margin: '48px auto', padding: '0 16px' }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/dashboard" style={{ fontSize: 14 }}>← Back to dashboard</Link>
      </div>
      <h1 style={{ marginBottom: 24 }}>New product</h1>
      <NewProductForm />
    </main>
  )
}
