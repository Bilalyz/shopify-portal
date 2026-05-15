# Shopify Product Portal — Developer Documentation v2

## Table of Contents

1. Product overview
2. What exists today (v1)
3. Tech stack
4. Current database schema
5. V2 architecture: multi-tenant model
6. Implementation phases
7. Phase 0: Multi-tenancy + super admin
8. Phase A: Admin settings (per org)
9. Phase B: AI-powered product enrichment
10. Phase C: Database + CSV additions
11. Phase D: UX quality layer
12. Environment variables
13. Supabase configuration
14. Deployment
15. File structure
16. Business model notes
17. Key architecture decisions

---

## 1. Product overview

A multi-tenant web portal where fashion brands and shops can add products (with images, variants, tags, and pricing), get AI-powered content optimization, and export Shopify-compatible CSV files for bulk product imports.

Each brand/shop operates as an isolated organization with its own settings, product catalog, tag presets, CSV column mappings, and AI context. Operators within an organization can see and manage all products belonging to that organization.

The portal was originally built for Mona Moda Style, an Israeli fashion brand. V2 expands it to serve multiple shops as a SaaS platform.

---

## 2. What exists today (v1)

Working features deployed on Vercel:

- Email + password authentication (Supabase Auth)
- Product CRUD: create, edit, delete with all Shopify-relevant fields
- Multi-image uploads to Supabase Storage with drag-and-drop and preview
- Variant support with consistent option names (defined once at product level, not per variant)
- Auto-capitalization of variant values to prevent Shopify duplicates ("red" → "Red")
- Bulk select: checkbox per product, select all, floating action bar for bulk export/delete
- CSV export matching the exact Shopify column format (validated with real imports)
- Timestamps displayed on dashboard and edit page (created_at, updated_at)
- Professional admin UI with light theme, responsive layout
- No currency symbols in price fields (Shopify applies store currency on import)
- Deployed on Vercel with auto-deploy from GitHub main branch
- Row Level Security on all database tables

Known v1 limitations:
- Single-tenant: no organization concept, products belong to individual users
- No admin settings: tags, types, colors are free-text input
- No AI assistance: descriptions, SEO fields, alt text are manual
- Root URL (/) shows default Next.js page instead of redirecting
- No concept of roles (owner, admin, operator)

---

## 3. Tech stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 16 (App Router, TypeScript) | Web application |
| Styling | Tailwind CSS | All UI, no component libraries |
| Database | Supabase (PostgreSQL) | Data storage, auth, file storage |
| Auth | Supabase Auth | Email + password authentication |
| File storage | Supabase Storage | Product image uploads |
| AI | Anthropic Claude API (claude-sonnet-4-20250514) | Vision, descriptions, SEO, tags |
| Hosting | Vercel | Auto-deploys from GitHub |
| Design skills | UI UX Pro Max (Claude Code skill) | Design intelligence for UI |
| Source control | GitHub | Repository |

Important: Next.js 16 uses proxy.ts instead of middleware.ts. The proxy function runs on Node.js runtime, not Edge.

---

## 4. Current database schema (v1)

### products
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Auto-generated |
| user_id | uuid (FK → auth.users) | Cascade delete |
| title | text | Required |
| description | text | Optional, will become AI-generated |
| product_type | text | Free text, will become dropdown |
| vendor | text | Free text, will become org default |
| tags | text[] | Postgres array, will become preset-driven |
| status | text | "draft" or "active" (check constraint) |
| price | numeric(10,2) | No currency symbol, >= 0 |
| compare_at_price | numeric(10,2) | Nullable, >= 0 |
| created_at | timestamptz | Auto |
| updated_at | timestamptz | Auto via trigger |

### variants
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Auto-generated |
| product_id | uuid (FK → products) | Cascade delete |
| option1_name | text | Set once at product level in UI |
| option1_value | text | Auto-capitalized on blur |
| option2_name | text | Optional second option |
| option2_value | text | Auto-capitalized on blur |
| price | numeric(10,2) | Per-variant price |
| sku | text | Per-variant SKU |
| inventory_qty | integer | >= 0 |
| created_at | timestamptz | Auto |

### product_images
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Auto-generated |
| product_id | uuid (FK → products) | Cascade delete |
| image_url | text | Public URL from Supabase storage |
| position | integer | Display/export order |
| alt_text | text | Currently manual, will become AI-generated |
| created_at | timestamptz | Auto |

### Row Level Security (v1)
- products: user_id = auth.uid()
- variants: EXISTS subquery checking parent product ownership
- product_images: same derived ownership pattern

### Indexes
- products(user_id), products(status), products(created_at DESC)
- variants(product_id)
- product_images(product_id, position)

---

## 5. V2 architecture: multi-tenant model

### Core concept

Every data record belongs to an organization (org), not a user. Users are members of organizations with specific roles. One user can belong to multiple organizations (e.g., the platform owner manages all of them).

### Data hierarchy

```
Platform (super admin sees everything)
├── Organization: Mona Moda Style
│   ├── Members: Owner, Operator A, Operator B
│   ├── Settings: tags, types, sizes, colors, CSV mapping, AI context
│   ├── Products (visible to all org members)
│   │   ├── Variants
│   │   └── Images
│   └── Exports / activity logs
├── Organization: Shoe Brand
│   ├── Members: Owner, Operator C, Operator D
│   ├── Settings: different tags, shoe sizes, different CSV columns
│   ├── Products
│   │   ├── Variants
│   │   └── Images
│   └── Exports / activity logs
└── ...more orgs
```

### Role model

| Role | Permissions |
|------|------------|
| super_admin | See all orgs, manage platform, access any org's data |
| owner | Full control of their org: settings, members, products, billing |
| admin | Manage settings and products, invite operators |
| operator | Add/edit/delete products, export CSV |

### Data isolation rules

- Operators within an org CAN see each other's products (confirmed requirement)
- Operators CANNOT see other orgs' data (enforced by RLS)
- Super admin CAN see everything (special RLS bypass or policy)
- Products belong to org_id; user_id tracks who uploaded (audit trail)
- Admin settings, tag presets, CSV mappings are all scoped by org_id

---

## 6. Implementation phases

Build order matters. Each phase depends on the one before it.

```
Phase 0: Multi-tenancy (organizations, members, roles, RLS refactor)
    ↓
Phase A: Admin settings per org (tags, types, sizes, colors, CSV mapping)
    ↓
Phase B: AI-powered enrichment (vision, descriptions, SEO, tag suggestions)
    ↓
Phase C: Database + CSV additions (seo_title, seo_description, alt_text mapping)
    ↓
Phase D: UX quality layer (content score, dropdowns, home redirect, polish)
```

---

## 7. Phase 0: Multi-tenancy + super admin

### New tables

#### organizations
```sql
create table public.organizations (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  slug           text unique not null,
  logo_url       text,
  shopify_domain text,
  default_vendor text,
  language       text not null default 'he',
  ai_brand_voice text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
```

#### organization_members
```sql
create table public.organization_members (
  id      uuid primary key default gen_random_uuid(),
  org_id  uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role    text not null default 'operator'
            check (role in ('super_admin', 'owner', 'admin', 'operator')),
  created_at timestamptz not null default now(),
  unique(org_id, user_id)
);
```

### Changes to existing tables

#### products — add org_id
```sql
alter table public.products
  add column org_id uuid references public.organizations(id) on delete cascade;

create index products_org_id_idx on public.products(org_id);
```

### RLS policy changes

All product policies change from:
```sql
user_id = auth.uid()
```
To:
```sql
org_id IN (
  select org_id from public.organization_members
  where user_id = auth.uid()
)
```

Super admin bypass:
```sql
OR EXISTS (
  select 1 from public.organization_members
  where user_id = auth.uid() and role = 'super_admin'
)
```

### App changes

- Org switcher in nav bar (dropdown showing user's orgs)
- Current org stored in cookie/session, read by all server actions
- All queries filter by current org_id
- New pages: /settings/org (manage org details), /settings/members (invite/manage)
- Invite flow: admin enters email → user gets invite → signs up → auto-added to org
- Super admin dashboard: /admin (list all orgs, usage stats, future billing)

### Migration plan for existing data

1. Create organizations table
2. Insert first org: Mona Moda Style
3. Create organization_members, link existing user(s) to Mona Moda org
4. Add org_id to products, backfill all existing products with Mona Moda's org_id
5. Drop old user_id-only RLS policies, create new org-based policies
6. Deploy and test

---

## 8. Phase A: Admin settings (per org)

### New table

#### org_settings
```sql
create table public.org_settings (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  
  -- Tag presets (the tags that drive Shopify smart collections)
  tag_presets        text[] not null default '{}',
  
  -- Product type options
  product_types      text[] not null default '{}',
  
  -- Size options (e.g., S, M, L, XL, or 36, 37, 38 for shoes)
  size_options       text[] not null default '{}',
  
  -- Color options
  color_options      text[] not null default '{}',
  
  -- CSV column mapping (stored as JSONB for flexibility)
  -- This is the header row from the client's Shopify export
  csv_columns        jsonb,
  
  -- AI description prompt template (customizable per org)
  ai_description_prompt text,
  
  -- AI language preference
  ai_language        text not null default 'he',
  
  -- AI brand voice description
  ai_brand_voice     text,
  
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(org_id)
);
```

### Settings UI

New page: /dashboard/settings

Sections:
- Organization details (name, logo, Shopify domain)
- Tag presets (add/remove tags, import from Shopify)
- Product types (add/remove)
- Sizes (add/remove)
- Colors (add/remove)
- CSV configuration (upload a sample CSV to auto-detect columns)
- AI settings (language, brand voice description, custom prompt template)

### How presets feed into the product form

- Product type: dropdown populated from org_settings.product_types
- Tags: multi-select checkboxes populated from org_settings.tag_presets
- Variant size values: dropdown from org_settings.size_options
- Variant color values: dropdown from org_settings.color_options
- All dropdowns allow typing a new value (combobox pattern) for flexibility
- Default vendor auto-filled from organizations.default_vendor

---

## 9. Phase B: AI-powered product enrichment

### Architecture

All AI calls go through Next.js server actions → Anthropic Claude API. Never expose the API key to the browser.

### API key

Stored as environment variable: `ANTHROPIC_API_KEY`
Model: claude-sonnet-4-20250514
Added to both .env.local and Vercel environment variables.

### Feature 1: Image vision analysis

Trigger: "Describe images" button on the product form (appears after images are uploaded).

Flow:
1. For each uploaded image, send it to Claude Vision API
2. System prompt includes: product title, product type, brand name, language
3. Claude returns a unique description for each image
4. Descriptions populate the alt_text field for each image
5. Image descriptions are also cached in state to feed into the description generator

What Claude Vision should identify per image:
- Garment type and key features visible
- Angle/view (front, back, side, close-up, detail)
- Colors and patterns visible
- Styling details (how it's worn, accessories shown)
- Fabric texture if visible

Example output for 3 images of a black dress:
- Image 1: "Front view of black midi dress with lace neckline and short sleeves"
- Image 2: "Back view showing concealed zipper and sheer lace panel detail"
- Image 3: "Close-up of delicate lace pattern on bodice with satin trim"

### Feature 2: Description generator

Trigger: "Generate description" button.

Inputs sent to Claude:
- Product title
- Product type (from dropdown)
- Image descriptions (from Feature 1)
- Tags selected
- Variant options (sizes, colors available)
- Brand voice from org settings
- Language from org settings

System prompt template (stored in org_settings, editable):
```
You are a fashion copywriter for {brand_name}. 
Write a product description in {language} for their Shopify store.

The description should be:
- 150-300 words
- SEO-optimized with natural keyword placement
- Highlight benefits over features
- Mention fabric, fit, occasion where relevant
- Include care hints if inferable from images
- Match the brand's voice: {brand_voice}
- Do NOT use generic filler phrases

Product: {title}
Type: {product_type}
Available in: {sizes} / {colors}
Image descriptions: {image_descriptions}

Write ONLY the description, no headings or labels.
```

Output: description text populated into the description field. User can edit before saving.

### Feature 3: SEO title + meta description

Generated in the same API call as the description (or a follow-up call).

Rules:
- SEO title: under 60 characters, main keyword first, in target language
- Meta description: 120-155 characters, benefit-focused, includes a subtle call-to-action
- Both should include the product type and a distinguishing feature

Output: populated into new seo_title and seo_description fields on the form.

### Feature 4: Smart tag suggestions

Trigger: runs automatically after description is generated, or via "Suggest tags" button.

Flow:
1. Send product info + description to Claude
2. System prompt includes the full list of available tags from org_settings.tag_presets
3. Claude picks 3-5 most relevant tags from the preset list
4. Suggestions appear as checked/unchecked checkboxes
5. User reviews and adjusts before saving

Important: Claude should ONLY suggest tags from the org's preset list, never invent new ones. This ensures smart collections continue to work correctly.

### UX flow for AI features

Single "Enrich with AI" button that runs all four features in sequence:
1. Analyze images → populate alt text
2. Generate description → populate description field  
3. Generate SEO title + meta description → populate SEO fields
4. Suggest tags → show tag checkboxes

Each field shows a subtle "AI generated" indicator. All fields are editable.

A "Regenerate" button next to each AI-generated field allows re-running that specific generation if the user isn't satisfied.

### Cost estimation

Per product enrichment (all 4 features):
- Image vision: ~$0.01-0.03 per image (depends on image size)
- Description + SEO: ~$0.01-0.02
- Tag suggestions: ~$0.005
- Total per product: ~$0.03-0.10 (assuming 2-3 images)
- For 100 products/month: ~$3-10/month in API costs

---

## 10. Phase C: Database + CSV additions

### New columns on products table

```sql
alter table public.products
  add column seo_title text,
  add column seo_description text;
```

### CSV mapping additions

These columns already exist in the Shopify CSV and were previously left empty:

| Database field | Shopify CSV column |
|---------------|-------------------|
| products.seo_title | SEO Title |
| products.seo_description | SEO Description |
| product_images.alt_text | Image Alt Text |

No new CSV columns needed. The existing column mapping handles these fields — they just weren't populated before.

---

## 11. Phase D: UX quality layer

### Content quality score

Calculated client-side, no API needed. Scoring rubric:

| Check | Points | Condition |
|-------|--------|-----------|
| Has title | 1 | title.length > 0 |
| Has description | 2 | description.length > 150 words |
| Has SEO title | 1 | seo_title exists and < 60 chars |
| Has meta description | 1 | seo_description exists and 120-155 chars |
| Has tags | 1 | 3-5 tags selected |
| Has images | 1 | At least 1 image uploaded |
| Images have alt text | 1 | All images have non-empty alt_text |
| Has variants | 1 | At least 1 variant defined |
| Has price | 1 | price > 0 |

Display: "7/10" progress bar with specific suggestions for missing items.
Color: green (8-10), amber (5-7), red (0-4).

### Dropdown inputs

Replace free-text inputs with combobox dropdowns:
- Product type → dropdown from org_settings.product_types
- Tags → multi-select from org_settings.tag_presets
- Variant size values → dropdown from org_settings.size_options
- Variant color values → dropdown from org_settings.color_options
- All allow typing a custom value (combobox) for edge cases

### Other UX items

- Home page redirect: app/page.tsx → redirect to /dashboard
- Client logo in nav bar: pulled from organizations.logo_url
- Org name in nav bar: dynamic based on current org

---

## 12. Environment variables

### Current (v1)
```
NEXT_PUBLIC_SUPABASE_URL=https://tfqeuxhvaynitbvcvokj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### Added in v2
```
ANTHROPIC_API_KEY=sk-ant-...
```

Note: ANTHROPIC_API_KEY is NOT prefixed with NEXT_PUBLIC_ because it must never be exposed to the browser. It's used only in server actions.

All variables must exist in both .env.local (local dev) and Vercel (production).

---

## 13. Supabase configuration

### Storage bucket

- Name: product-images
- Type: public bucket
- Policies: authenticated users can upload/delete, anyone can read

### Auth settings

- Provider: email + password
- Email confirmation: OFF for development, ON for production
- Password requirements: Supabase defaults

### RLS

Enabled on ALL tables. No table should ever have RLS disabled. See Phase 0 for the multi-tenant policy pattern.

---

## 14. Deployment

- Vercel auto-deploys from main branch on GitHub
- Push to main → build → deploy (1-2 minutes)
- Environment variables set in Vercel dashboard (Settings → Environment Variables)
- Current production URL: shopify-portal-*.vercel.app/login
- Custom domain can be added in Vercel Settings → Domains

---

## 15. File structure (current v1, will expand in v2)

```
shopify-portal/
├── app/
│   ├── actions/              # Server actions (auth, products, export)
│   ├── auth/callback/        # Supabase auth code exchange
│   ├── dashboard/            # Main dashboard + product pages
│   │   ├── products/
│   │   │   ├── new/          # Create product form
│   │   │   └── [id]/edit/    # Edit product form
│   │   └── settings/         # [v2] Org settings page
│   ├── admin/                # [v2] Super admin panel
│   ├── login/                # Sign in / sign up
│   └── page.tsx              # Home (needs redirect)
├── lib/
│   ├── supabase/
│   │   ├── client.ts         # Browser Supabase client
│   │   └── server.ts         # Server Supabase client
│   └── ai/                   # [v2] Claude API integration
│       ├── vision.ts         # Image analysis
│       ├── description.ts    # Description generator
│       ├── seo.ts            # SEO title + meta description
│       └── tags.ts           # Tag suggestions
├── proxy.ts                  # Next.js 16 proxy (auth + org routing)
├── supabase/migrations/      # SQL migration files
├── .claude/skills/            # UI UX Pro Max skill files
├── CLAUDE.md                 # Claude Code project instructions
├── DEVELOPER.md              # This file
└── .env.local                # Local env vars (gitignored)
```

---

## 16. Business model notes

### Pricing considerations (future)

The portal is designed to support per-org billing in the future:
- Organizations table can be extended with: plan (free/pro/enterprise), billing_email, stripe_customer_id, subscription_status
- Usage tracking: product count per org, AI enrichment calls per org, export count per org
- Suggested tiers: free (X products, no AI), pro (unlimited products + AI), enterprise (custom CSV mapping + priority support)

### Cost structure per org

- Supabase: free tier covers small usage, Pro plan at $25/mo for production
- Vercel: free tier for hobby, Pro at $20/mo for teams
- Claude API: ~$0.03-0.10 per product enrichment
- Total platform cost: ~$45-50/mo + API usage
- Break-even: 2-3 paying clients at ~$20-30/mo each

### Data ownership

Each org's data is isolated by RLS. If an org leaves, their data can be exported and their records deleted without affecting other orgs.

---

## 17. Key architecture decisions

### Why multi-tenant single database (not separate databases per client)

One Supabase project, one codebase, one deployment. RLS enforces data isolation at the database level — it's impossible for a query to accidentally return another org's data. This is simpler to maintain, deploy, and scale than running separate instances per client.

### Why org_id on products (not just user_id)

Products belong to the business, not the person who uploaded them. When an operator leaves, their products stay with the org. Multiple operators can see and edit each other's work. The user_id remains as an audit trail ("who uploaded this").

### Why Claude API for AI features (not Gemini or OpenAI)

Claude is already available with no extra setup (Anthropic's API). It has strong vision capabilities for image analysis, handles Hebrew well, and the portal is already built on Claude Code. Using Google's models doesn't improve SEO — Google ranks based on content quality, not which AI generated it.

### Why auto-capitalize variant values

Shopify treats "Red" and "red" as different option values, creating duplicate variants. Auto-capitalizing on blur prevents this silently. The user doesn't need to think about it.

### Why no currency symbols

The client's Shopify store uses ₪ (Israeli Shekel). Other future clients may use €, $, or other currencies. Shopify applies the store's currency automatically on CSV import. Showing any symbol in the portal would mislead users whose store uses a different currency.

### Why option names defined once at product level

Shopify requires consistent option names across all variants of a product. If Option 1 is "Size" for one variant, it must be "Size" for all variants. The UI enforces this by defining names once at the top, preventing the inconsistency bug we found during testing.

### Why tags from preset lists only (in AI suggestions)

Tags drive Shopify smart collections. A tag that doesn't match an existing collection rule is useless. The AI should only suggest tags the org has already configured — never invent new ones. This ensures every suggested tag actually does something in the store.

### Why image-based alt text (not just title-based)

Three images of the same dress need three different alt texts. "Black evening dress" repeated three times is useless for SEO and accessibility. Vision analysis describes what's actually in each image: front view, back detail, fabric close-up. This is a genuine differentiator from other Shopify tools.
