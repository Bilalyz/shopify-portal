-- ============================================================
-- Phase A: Org settings table
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor).
-- ============================================================

create table public.org_settings (
  id              uuid        primary key default gen_random_uuid(),
  org_id          uuid        not null references public.organizations(id) on delete cascade,
  tag_presets     text[]      not null default '{}',
  product_types   text[]      not null default '{}',
  size_options    text[]      not null default '{}',
  color_options   text[]      not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(org_id)
);

create trigger org_settings_set_updated_at
  before update on public.org_settings
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS
-- ============================================================

alter table public.org_settings enable row level security;

-- All org members can read their org's settings
create policy "org_settings: members can select"
  on public.org_settings for select
  using (
    org_id in (
      select org_id from public.organization_members
      where user_id = auth.uid()
    )
    or exists (
      select 1 from public.organization_members
      where user_id = auth.uid() and role = 'super_admin'
    )
  );

-- Admins, owners, and super_admins can create settings rows
create policy "org_settings: admins can insert"
  on public.org_settings for insert
  with check (
    org_id in (
      select org_id from public.organization_members
      where user_id = auth.uid()
        and role in ('admin', 'owner', 'super_admin')
    )
  );

-- Admins, owners, and super_admins can update settings
create policy "org_settings: admins can update"
  on public.org_settings for update
  using (
    org_id in (
      select org_id from public.organization_members
      where user_id = auth.uid()
        and role in ('admin', 'owner', 'super_admin')
    )
  );
