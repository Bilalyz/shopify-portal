import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import DashboardNav from '@/app/dashboard/_nav'
import EditProductForm from './_form'

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ saved?: string }>
}) {
  const { id } = await params
  const { saved } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: product } = await supabase
    .from('products')
    .select('title, description, product_type, vendor, tags, status, price, compare_at_price')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!product) notFound()

  const { data: variantRows } = await supabase
    .from('variants')
    .select('id, option1_name, option1_value, option2_name, option2_value, price, sku, inventory_qty')
    .eq('product_id', id)
    .order('created_at', { ascending: true })

  const { data: imageRows } = await supabase
    .from('product_images')
    .select('id, image_url')
    .eq('product_id', id)
    .order('position', { ascending: true })

  const existingImages = (imageRows ?? []).map((img) => ({
    id: img.id,
    image_url: img.image_url,
    publicUrl: supabase.storage.from('product-images').getPublicUrl(img.image_url).data.publicUrl,
  }))

  const existingVariants = (variantRows ?? []).map((v) => ({
    id: v.id,
    dbId: v.id,
    option1_name:  v.option1_name  ?? '',
    option1_value: v.option1_value ?? '',
    option2_name:  v.option2_name  ?? '',
    option2_value: v.option2_value ?? '',
    price:         String(v.price  ?? ''),
    sku:           v.sku           ?? '',
    inventory_qty: String(v.inventory_qty ?? ''),
  }))

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors duration-150 mb-6"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to dashboard
        </Link>

        <h1 className="text-xl font-semibold text-gray-900 mb-6">Edit product</h1>

        {saved === '1' && (
          <div className="flex items-center gap-2.5 mb-6 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            Product saved successfully.
          </div>
        )}

        <EditProductForm
          productId={id}
          initialData={product}
          initialImages={existingImages}
          initialVariants={existingVariants}
        />
      </main>
    </div>
  )
}
