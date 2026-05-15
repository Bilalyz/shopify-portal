import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/auth/org'
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

  const orgContext = await getOrgContext()
  if (!orgContext) redirect('/orgs')

  const orgId = orgContext.current.orgId

  const [
    { data: product },
    { data: variantRows },
    { data: imageRows },
    { data: settings },
    { data: org },
  ] = await Promise.all([
    supabase
      .from('products')
      .select('title, description, product_type, vendor, tags, status, price, compare_at_price, seo_title, seo_description, created_at, updated_at')
      .eq('id', id)
      .eq('org_id', orgId)
      .single(),
    supabase
      .from('variants')
      .select('id, option1_name, option1_value, option2_name, option2_value, price, sku, inventory_qty')
      .eq('product_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('product_images')
      .select('id, image_url, alt_text')
      .eq('product_id', id)
      .order('position', { ascending: true }),
    supabase
      .from('org_settings')
      .select('tag_presets, product_types, size_options, color_options')
      .eq('org_id', orgId)
      .maybeSingle(),
    supabase
      .from('organizations')
      .select('language, ai_brand_voice')
      .eq('id', orgId)
      .single(),
  ])

  if (!product) notFound()

  const presets = {
    tagPresets:   settings?.tag_presets   ?? [],
    productTypes: settings?.product_types ?? [],
    sizeOptions:  settings?.size_options  ?? [],
    colorOptions: settings?.color_options ?? [],
    language: org?.language ?? 'he',
    brandVoice: org?.ai_brand_voice ?? '',
  }

  const existingImages = (imageRows ?? []).map((img) => ({
    id: img.id,
    image_url: img.image_url,
    alt_text: img.alt_text ?? '',
    publicUrl: supabase.storage.from('product-images').getPublicUrl(img.image_url).data.publicUrl,
  }))

  const firstVar = variantRows?.[0]
  const initialOption1Name = firstVar?.option1_name ?? ''
  const initialOption2Name = firstVar?.option2_name ?? ''
  const initialHasOption2 = (variantRows ?? []).some((v) => v.option2_name || v.option2_value)

  const existingVariants = (variantRows ?? []).map((v) => ({
    id: v.id,
    dbId: v.id,
    option1_value: v.option1_value ?? '',
    option2_value: v.option2_value ?? '',
    price:         String(v.price  ?? ''),
    sku:           v.sku           ?? '',
    inventory_qty: String(v.inventory_qty ?? ''),
  }))

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors duration-150 mb-6"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to dashboard
        </Link>

        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Edit product</h1>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
            <span>
              Created{' '}
              {new Date(product.created_at).toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric',
              })}
            </span>
            <span className="text-gray-200">·</span>
            <span>
              Last updated{' '}
              {new Date(product.updated_at).toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric',
              })}
            </span>
          </div>
        </div>

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
          initialOption1Name={initialOption1Name}
          initialHasOption2={initialHasOption2}
          initialOption2Name={initialOption2Name}
          presets={presets}
        />
      </main>
    </div>
  )
}
