import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/auth/org'
import DashboardNav from '@/app/dashboard/_nav'
import OrgDetailsForm from './_org-details-form'
import PresetEditor from './_preset-editor'

const ADMIN_ROLES = ['super_admin', 'owner', 'admin']

function SectionCard({ title, description, children }: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  )
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orgContext = await getOrgContext()
  if (!orgContext) redirect('/orgs')
  if (!ADMIN_ROLES.includes(orgContext.current.role)) redirect('/dashboard')

  const orgId = orgContext.current.orgId

  // Fetch org details
  const { data: org } = await supabase
    .from('organizations')
    .select('name, default_vendor, language')
    .eq('id', orgId)
    .single()

  // Fetch org settings — create row if it doesn't exist yet
  let { data: settings } = await supabase
    .from('org_settings')
    .select('tag_presets, product_types, size_options, color_options')
    .eq('org_id', orgId)
    .single()

  if (!settings) {
    await supabase.from('org_settings').insert({ org_id: orgId })
    settings = { tag_presets: [], product_types: [], size_options: [], color_options: [] }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">{orgContext.current.orgName}</p>
        </div>

        <div className="space-y-6">

          <SectionCard
            title="Organization details"
            description="Basic information about your organization"
          >
            <OrgDetailsForm
              initialName={org?.name ?? ''}
              initialDefaultVendor={org?.default_vendor ?? null}
              initialLanguage={org?.language ?? 'he'}
            />
          </SectionCard>

          <SectionCard
            title="Tag presets"
            description="Tags available when creating products. Tags drive Shopify smart collections."
          >
            <PresetEditor
              field="tag_presets"
              initialItems={settings.tag_presets ?? []}
              label="Tags"
              placeholder='e.g. "Summer Sale", "New Arrival"'
            />
          </SectionCard>

          <SectionCard
            title="Product types"
            description="Product type options shown in the product form"
          >
            <PresetEditor
              field="product_types"
              initialItems={settings.product_types ?? []}
              label="Product types"
              placeholder='e.g. "Dress", "Pants", "Top"'
            />
          </SectionCard>

          <SectionCard
            title="Size options"
            description="Size values shown when adding variants"
          >
            <PresetEditor
              field="size_options"
              initialItems={settings.size_options ?? []}
              label="Sizes"
              placeholder='e.g. "S", "M", "L", "XL"'
            />
          </SectionCard>

          <SectionCard
            title="Color options"
            description="Color values shown when adding variants"
          >
            <PresetEditor
              field="color_options"
              initialItems={settings.color_options ?? []}
              label="Colors"
              placeholder='e.g. "Black", "White", "Red"'
            />
          </SectionCard>

        </div>
      </main>
    </div>
  )
}
