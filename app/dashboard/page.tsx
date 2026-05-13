import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import DashboardNav from './_nav'
import ExportButton from './_export-button'
import DeleteButton from './_delete-button'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: rawProducts } = await supabase
    .from('products')
    .select('id, title, status, price, product_images(image_url, position), variants(id)')
    .order('created_at', { ascending: false })

  type ProductImage = { image_url: string; position: number }
  type RawProduct = {
    id: string
    title: string
    status: string
    price: number
    product_images: ProductImage[] | null
    variants: { id: string }[] | null
  }

  const products = (rawProducts as RawProduct[] | null)?.map((p) => {
    const firstImage = (p.product_images ?? []).sort((a, b) => a.position - b.position)[0]
    const thumbUrl = firstImage
      ? supabase.storage.from('product-images').getPublicUrl(firstImage.image_url).data.publicUrl
      : null
    const variantCount = (p.variants ?? []).length
    return { ...p, thumbUrl, variantCount }
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Products</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {products?.length ?? 0} product{(products?.length ?? 0) !== 1 ? 's' : ''} total
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <ExportButton />
            <Link
              href="/dashboard/products/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors duration-150"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New product
            </Link>
          </div>
        </div>

        {/* Table card */}
        {!products || products.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl px-6 py-16 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M9 21V9" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-gray-900 mb-1">No products yet</h3>
            <p className="text-sm text-gray-500 mb-5">Get started by adding your first product.</p>
            <Link
              href="/dashboard/products/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors duration-150"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add first product
            </Link>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4 w-16" />
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">Product</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">Status</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">Price</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4 hidden sm:table-cell">Variants</th>
                  <th className="py-3 px-4 w-28" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors duration-100 group">
                    <td className="py-3 px-4">
                      {p.thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.thumbUrl}
                          alt={p.title}
                          width={40}
                          height={40}
                          className="w-10 h-10 object-cover rounded-lg border border-gray-200"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                          <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <path d="m21 15-5-5L5 21" />
                          </svg>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        href={`/dashboard/products/${p.id}/edit`}
                        className="text-sm font-medium text-gray-900 hover:text-gray-600 transition-colors duration-150"
                      >
                        {p.title}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        p.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700">
                      ${Number(p.price).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500 hidden sm:table-cell">
                      {p.variantCount > 0
                        ? `${p.variantCount} variant${p.variantCount !== 1 ? 's' : ''}`
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/dashboard/products/${p.id}/edit`}
                          className="text-xs font-medium text-gray-600 border border-gray-200 px-2.5 py-1 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                        >
                          Edit
                        </Link>
                        <DeleteButton productId={p.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
