-- Custom product categories added by admins via the product form.
-- Built-in categories (Necklaces, Airdry Clay Crafts, Fake Cakes) remain
-- hardcoded in src/lib/productCategories.ts and are NOT stored here.
-- RLS: only the service-role server client (admin) reads/writes this table.

create table if not exists custom_categories (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  created_at timestamptz default now()
);

alter table custom_categories enable row level security;

-- No permissive RLS policies — only the service-role key (getSupabaseServer())
-- can access this table, which bypasses RLS by design.
-- This means anon/authenticated clients cannot read or write custom_categories.

create unique index if not exists idx_custom_categories_name
  on custom_categories (name);

comment on table custom_categories is 'Admin-managed custom product categories. Built-in categories live in productCategories.ts.';
