-- ============================================================
-- Shopify Product Portal — initial schema
-- Paste this into Supabase SQL Editor and click Run.
-- ============================================================


-- ------------------------------------------------------------
-- 1. products
-- ------------------------------------------------------------
create table public.products (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,

  title            text not null,
  description      text,
  product_type     text,
  vendor           text,
  tags             text[],

  status           text not null default 'draft'
                     check (status in ('draft', 'active')),

  price            numeric(10, 2) not null default 0
                     check (price >= 0),
  compare_at_price numeric(10, 2)
                     check (compare_at_price is null or compare_at_price >= 0),

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- keep updated_at current on every write
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- indexes
create index products_user_id_idx  on public.products (user_id);
create index products_status_idx   on public.products (status);
create index products_created_at_idx on public.products (created_at desc);


-- ------------------------------------------------------------
-- 2. variants
-- ------------------------------------------------------------
create table public.variants (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products (id) on delete cascade,

  option1_name   text,
  option1_value  text,
  option2_name   text,
  option2_value  text,

  price          numeric(10, 2) not null default 0
                   check (price >= 0),
  sku            text,
  inventory_qty  integer not null default 0
                   check (inventory_qty >= 0),

  created_at     timestamptz not null default now()
);

create index variants_product_id_idx on public.variants (product_id);


-- ------------------------------------------------------------
-- 3. product_images
-- ------------------------------------------------------------
create table public.product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,

  image_url  text not null,
  position   integer not null default 0,
  alt_text   text,

  created_at timestamptz not null default now()
);

create index product_images_product_id_idx on public.product_images (product_id);
create index product_images_position_idx   on public.product_images (product_id, position);


-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.products      enable row level security;
alter table public.variants      enable row level security;
alter table public.product_images enable row level security;


-- ------------------------------------------------------------
-- products policies
-- Each authenticated user may only see and modify their own rows.
-- ------------------------------------------------------------
create policy "products: owner select"
  on public.products for select
  to authenticated
  using (user_id = auth.uid());

create policy "products: owner insert"
  on public.products for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "products: owner update"
  on public.products for update
  to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "products: owner delete"
  on public.products for delete
  to authenticated
  using (user_id = auth.uid());


-- ------------------------------------------------------------
-- variants policies
-- Variants don't store user_id directly; access is derived
-- through the parent product.
-- ------------------------------------------------------------
create policy "variants: owner select"
  on public.variants for select
  to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = variants.product_id
        and p.user_id = auth.uid()
    )
  );

create policy "variants: owner insert"
  on public.variants for insert
  to authenticated
  with check (
    exists (
      select 1 from public.products p
      where p.id = variants.product_id
        and p.user_id = auth.uid()
    )
  );

create policy "variants: owner update"
  on public.variants for update
  to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = variants.product_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = variants.product_id
        and p.user_id = auth.uid()
    )
  );

create policy "variants: owner delete"
  on public.variants for delete
  to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = variants.product_id
        and p.user_id = auth.uid()
    )
  );


-- ------------------------------------------------------------
-- product_images policies  (same derived-ownership pattern)
-- ------------------------------------------------------------
create policy "product_images: owner select"
  on public.product_images for select
  to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id
        and p.user_id = auth.uid()
    )
  );

create policy "product_images: owner insert"
  on public.product_images for insert
  to authenticated
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id
        and p.user_id = auth.uid()
    )
  );

create policy "product_images: owner update"
  on public.product_images for update
  to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id
        and p.user_id = auth.uid()
    )
  );

create policy "product_images: owner delete"
  on public.product_images for delete
  to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id
        and p.user_id = auth.uid()
    )
  );
