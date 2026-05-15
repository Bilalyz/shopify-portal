-- ============================================================
-- Phase 0: Multi-tenancy + super admin
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor).
-- ============================================================
--
-- What this migration does, in order:
--   1. Create organizations table + updated_at trigger
--   2. Create organization_members table + indexes
--   3. Add org_id column to products + index
--   4. Drop all v1 RLS policies on products / variants / product_images
--   5. Create security-definer helper functions (avoid recursive RLS)
--   6. Enable RLS on new tables
--   7. Create new org-scoped RLS policies on all 5 tables
--   8. Data migration: insert Mona Moda org, link user, backfill products
-- ============================================================


-- ============================================================
-- 1. organizations
-- ============================================================

create table public.organizations (
  id             uuid        primary key default gen_random_uuid(),
  name           text        not null,
  slug           text        unique not null,
  logo_url       text,
  shopify_domain text,
  default_vendor text,
  language       text        not null default 'he',
  ai_brand_voice text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Reuse the set_updated_at() function created in the initial schema.
create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();


-- ============================================================
-- 2. organization_members
-- ============================================================

create table public.organization_members (
  id         uuid        primary key default gen_random_uuid(),
  org_id     uuid        not null references public.organizations(id)  on delete cascade,
  user_id    uuid        not null references auth.users(id)             on delete cascade,
  role       text        not null default 'operator'
               check (role in ('super_admin', 'owner', 'admin', 'operator')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index org_members_org_id_idx  on public.organization_members (org_id);
create index org_members_user_id_idx on public.organization_members (user_id);


-- ============================================================
-- 3. Add org_id to products
-- ============================================================
-- Nullable so existing rows survive until the backfill in step 8.

alter table public.products
  add column org_id uuid references public.organizations(id) on delete cascade;

create index products_org_id_idx on public.products (org_id);


-- ============================================================
-- 4. Drop all v1 RLS policies
-- ============================================================

drop policy if exists "products: owner select"         on public.products;
drop policy if exists "products: owner insert"         on public.products;
drop policy if exists "products: owner update"         on public.products;
drop policy if exists "products: owner delete"         on public.products;

drop policy if exists "variants: owner select"         on public.variants;
drop policy if exists "variants: owner insert"         on public.variants;
drop policy if exists "variants: owner update"         on public.variants;
drop policy if exists "variants: owner delete"         on public.variants;

drop policy if exists "product_images: owner select"   on public.product_images;
drop policy if exists "product_images: owner insert"   on public.product_images;
drop policy if exists "product_images: owner update"   on public.product_images;
drop policy if exists "product_images: owner delete"   on public.product_images;


-- ============================================================
-- 5. Security-definer helper functions
-- ============================================================
-- These run as the function owner (postgres = superuser), which
-- bypasses RLS on organization_members. Using helpers in all
-- policies prevents recursive RLS evaluation on that table and
-- also centralises the membership logic.
-- set search_path = public guards against search_path injection.
-- ============================================================

-- Is the calling user a super_admin in ANY org?
create or replace function public.is_super_admin()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1
    from   public.organization_members
    where  user_id = auth.uid()
      and  role    = 'super_admin'
  )
$$;

-- Is the calling user a member of a specific org (any role)?
create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1
    from   public.organization_members
    where  org_id  = p_org_id
      and  user_id = auth.uid()
  )
$$;

-- Is the calling user an owner/admin/super_admin within a specific org?
-- Used for write-access checks on organization_members.
create or replace function public.is_org_admin(p_org_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1
    from   public.organization_members
    where  org_id  = p_org_id
      and  user_id = auth.uid()
      and  role in ('super_admin', 'owner', 'admin')
  )
$$;

-- Is the calling user the owner of a specific org?
-- Used for role-change and org-update policies.
create or replace function public.is_org_owner(p_org_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1
    from   public.organization_members
    where  org_id  = p_org_id
      and  user_id = auth.uid()
      and  role    = 'owner'
  )
$$;


-- ============================================================
-- 6. Enable RLS on new tables
-- ============================================================

alter table public.organizations        enable row level security;
alter table public.organization_members enable row level security;


-- ============================================================
-- 7. New RLS policies
-- ============================================================

-- ------------------------------------------------------------
-- products
-- Access: org member (any role), OR platform super_admin.
-- ------------------------------------------------------------

create policy "products: org member select"
  on public.products for select to authenticated
  using (
    public.is_super_admin()
    or (org_id is not null and public.is_org_member(org_id))
  );

create policy "products: org member insert"
  on public.products for insert to authenticated
  with check (
    public.is_super_admin()
    or (org_id is not null and public.is_org_member(org_id))
  );

create policy "products: org member update"
  on public.products for update to authenticated
  using (
    public.is_super_admin()
    or (org_id is not null and public.is_org_member(org_id))
  )
  with check (
    public.is_super_admin()
    or (org_id is not null and public.is_org_member(org_id))
  );

create policy "products: org member delete"
  on public.products for delete to authenticated
  using (
    public.is_super_admin()
    or (org_id is not null and public.is_org_member(org_id))
  );


-- ------------------------------------------------------------
-- variants
-- Access derived from the parent product's org membership.
-- ------------------------------------------------------------

create policy "variants: org member select"
  on public.variants for select to authenticated
  using (
    exists (
      select 1 from public.products p
      where  p.id = variants.product_id
        and  (
          public.is_super_admin()
          or (p.org_id is not null and public.is_org_member(p.org_id))
        )
    )
  );

create policy "variants: org member insert"
  on public.variants for insert to authenticated
  with check (
    exists (
      select 1 from public.products p
      where  p.id = variants.product_id
        and  (
          public.is_super_admin()
          or (p.org_id is not null and public.is_org_member(p.org_id))
        )
    )
  );

create policy "variants: org member update"
  on public.variants for update to authenticated
  using (
    exists (
      select 1 from public.products p
      where  p.id = variants.product_id
        and  (
          public.is_super_admin()
          or (p.org_id is not null and public.is_org_member(p.org_id))
        )
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where  p.id = variants.product_id
        and  (
          public.is_super_admin()
          or (p.org_id is not null and public.is_org_member(p.org_id))
        )
    )
  );

create policy "variants: org member delete"
  on public.variants for delete to authenticated
  using (
    exists (
      select 1 from public.products p
      where  p.id = variants.product_id
        and  (
          public.is_super_admin()
          or (p.org_id is not null and public.is_org_member(p.org_id))
        )
    )
  );


-- ------------------------------------------------------------
-- product_images
-- Access derived from the parent product's org membership.
-- ------------------------------------------------------------

create policy "product_images: org member select"
  on public.product_images for select to authenticated
  using (
    exists (
      select 1 from public.products p
      where  p.id = product_images.product_id
        and  (
          public.is_super_admin()
          or (p.org_id is not null and public.is_org_member(p.org_id))
        )
    )
  );

create policy "product_images: org member insert"
  on public.product_images for insert to authenticated
  with check (
    exists (
      select 1 from public.products p
      where  p.id = product_images.product_id
        and  (
          public.is_super_admin()
          or (p.org_id is not null and public.is_org_member(p.org_id))
        )
    )
  );

create policy "product_images: org member update"
  on public.product_images for update to authenticated
  using (
    exists (
      select 1 from public.products p
      where  p.id = product_images.product_id
        and  (
          public.is_super_admin()
          or (p.org_id is not null and public.is_org_member(p.org_id))
        )
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where  p.id = product_images.product_id
        and  (
          public.is_super_admin()
          or (p.org_id is not null and public.is_org_member(p.org_id))
        )
    )
  );

create policy "product_images: org member delete"
  on public.product_images for delete to authenticated
  using (
    exists (
      select 1 from public.products p
      where  p.id = product_images.product_id
        and  (
          public.is_super_admin()
          or (p.org_id is not null and public.is_org_member(p.org_id))
        )
    )
  );


-- ------------------------------------------------------------
-- organizations
-- ------------------------------------------------------------

-- Members see their own orgs; super_admin sees all.
create policy "organizations: member select"
  on public.organizations for select to authenticated
  using (
    public.is_super_admin()
    or public.is_org_member(id)
  );

-- Only super_admin can create new orgs via the app.
-- (The first org is created by the DO block below, which runs as
--  postgres superuser and bypasses RLS entirely.)
create policy "organizations: super_admin insert"
  on public.organizations for insert to authenticated
  with check (public.is_super_admin());

-- Org owner or super_admin can update org details.
create policy "organizations: owner update"
  on public.organizations for update to authenticated
  using  (public.is_super_admin() or public.is_org_owner(id))
  with check (public.is_super_admin() or public.is_org_owner(id));

-- Only super_admin can delete orgs.
create policy "organizations: super_admin delete"
  on public.organizations for delete to authenticated
  using (public.is_super_admin());


-- ------------------------------------------------------------
-- organization_members
-- All membership checks route through security-definer helpers
-- to avoid recursive RLS on this table.
-- ------------------------------------------------------------

-- Members see everyone in their org(s); super_admin sees all rows.
create policy "organization_members: member select"
  on public.organization_members for select to authenticated
  using (
    public.is_super_admin()
    or public.is_org_member(org_id)
  );

-- Owners and admins can add members to their org; super_admin anywhere.
create policy "organization_members: admin insert"
  on public.organization_members for insert to authenticated
  with check (
    public.is_super_admin()
    or public.is_org_admin(org_id)
  );

-- Only org owner or super_admin can change a member's role.
create policy "organization_members: owner update"
  on public.organization_members for update to authenticated
  using  (public.is_super_admin() or public.is_org_owner(org_id))
  with check (public.is_super_admin() or public.is_org_owner(org_id));

-- Org owner or super_admin can remove members.
create policy "organization_members: owner delete"
  on public.organization_members for delete to authenticated
  using (public.is_super_admin() or public.is_org_owner(org_id));


-- ============================================================
-- 8. Data migration
-- ============================================================
-- Creates the Mona Moda Style org, links the existing user as
-- super_admin (gives full platform + org access), then backfills
-- org_id on all existing products.
--
-- The DO block runs as postgres (superuser) — RLS does not apply.
-- It raises an exception and aborts cleanly if the user is missing.
-- ============================================================

do $$
declare
  v_org_id  uuid;
  v_user_id uuid;
begin
  -- 1. Insert org
  insert into public.organizations (name, slug, default_vendor, language)
  values ('Mona Moda Style', 'mona-moda-style', 'Mona Moda', 'he')
  returning id into v_org_id;

  -- 2. Find the existing user
  select id
  into   v_user_id
  from   auth.users
  where  email = 'marketticker247@gmail.com'
  limit  1;

  if v_user_id is null then
    raise exception
      'User not found: marketticker247@gmail.com — verify the email in this script.';
  end if;

  -- 3. Add user as super_admin.
  --    super_admin role satisfies is_super_admin() (platform-wide bypass)
  --    AND is_org_member() (so they can see Mona Moda data directly).
  --    The unique(org_id, user_id) constraint allows only one row per
  --    user per org, so a single row with the highest role is correct.
  insert into public.organization_members (org_id, user_id, role)
  values (v_org_id, v_user_id, 'super_admin');

  -- 4. Backfill org_id on all existing products
  update public.products
  set    org_id = v_org_id
  where  org_id is null;

  raise notice 'Phase 0 complete. org_id = %', v_org_id;
end;
$$;
