import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/auth/org'
import DashboardNav from '@/app/dashboard/_nav'
import NewProductForm from './_form'

export default async function NewProductPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const orgContext = await getOrgContext()
  if (!orgContext) redirect('/orgs')

  const orgId = orgContext.current.orgId

  const [{ data: settings }, { data: org }] = await Promise.all([
    supabase
      .from('org_settings')
      .select('tag_presets, product_types, size_options, color_options')
      .eq('org_id', orgId)
      .maybeSingle(),
    supabase
      .from('organizations')
      .select('default_vendor')
      .eq('id', orgId)
      .single(),
  ])

  const presets = {
    tagPresets:   settings?.tag_presets   ?? [],
    productTypes: settings?.product_types ?? [],
    sizeOptions:  settings?.size_options  ?? [],
    colorOptions: settings?.color_options ?? [],
    defaultVendor: org?.default_vendor ?? null,
  }

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

        <h1 className="text-xl font-semibold text-gray-900 mb-8">New product</h1>
        <NewProductForm presets={presets} />
      </main>
    </div>
  )
}
