-- Phase B: Add SEO fields to products
alter table public.products
  add column if not exists seo_title       text,
  add column if not exists seo_description text;
