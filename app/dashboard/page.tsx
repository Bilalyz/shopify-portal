import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/auth/org'
import DashboardNav from './_nav'
import ExportButton from './_export-button'
import ProductTable from './_product-table'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const orgContext = await getOrgContext()
  if (!orgContext) redirect('/orgs')

  const { data: rawProducts } = await supabase
    .from('products')
    .select('id, title, status, price, created_at, product_images(image_url, position), variants(id)')
    .eq('org_id', orgContext.current.orgId)
    .order('created_at', { ascending: false })

  type ProductImage = { image_url: string; position: number }
  type RawProduct = {
    id: string
    title: string
    status: string
    price: number
    created_at: string
    product_images: ProductImage[] | null
    variants: { id: string }[] | null
  }

  const products = (rawProducts as RawProduct[] | null)?.map((p) => {
    const firstImage = (p.product_images ?? []).sort((a, b) => a.position - b.position)[0]
    const thumbUrl = firstImage
      ? supabase.storage.from('product-images').getPublicUrl(firstImage.image_url).data.publicUrl
      : null
    const variantCount = (p.variants ?? []).length
    return {
      id: p.id,
      title: p.title,
      status: p.status,
      price: p.price,
      created_at: p.created_at,
      thumbUrl,
      variantCount,
    }
  }) ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Products</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {products.length} product{products.length !== 1 ? 's' : ''} total
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

        <ProductTable products={products} />
      </main>
    </div>
  )
}
