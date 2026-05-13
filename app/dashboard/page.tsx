import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/actions/auth'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: products } = await supabase
    .from('products')
    .select('id, title, status, price')
    .order('created_at', { ascending: false })

  return (
    <main style={{ maxWidth: 720, margin: '48px auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <form action={signOut}>
          <button type="submit" style={{ padding: '6px 14px', fontSize: 13 }}>Sign out</button>
        </form>
      </div>
      <p style={{ marginTop: 4, marginBottom: 32, color: '#555' }}>{user.email}</p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Products</h2>
        <Link
          href="/dashboard/products/new"
          style={{ padding: '6px 14px', fontSize: 13, border: '1px solid #ccc', textDecoration: 'none' }}
        >
          + Add new product
        </Link>
      </div>

      {!products || products.length === 0 ? (
        <p style={{ color: '#777' }}>No products yet. <Link href="/dashboard/products/new">Create your first one.</Link></p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
              <th style={{ padding: '8px 12px' }}>Title</th>
              <th style={{ padding: '8px 12px' }}>Status</th>
              <th style={{ padding: '8px 12px' }}>Price</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px 12px' }}>{p.title}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{
                    fontSize: 12,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: p.status === 'active' ? '#d1fae5' : '#f3f4f6',
                    color: p.status === 'active' ? '#065f46' : '#374151',
                  }}>
                    {p.status}
                  </span>
                </td>
                <td style={{ padding: '10px 12px' }}>${Number(p.price).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}
