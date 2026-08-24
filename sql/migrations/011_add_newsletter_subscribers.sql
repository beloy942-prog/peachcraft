-- Newsletter subscribers collected via the footer signup form.
-- RLS: anonymous/authenticated clients may INSERT only — no SELECT/UPDATE/DELETE
-- from the client. Admin reads go through the service-role server client
-- (getSupabaseServer()), which bypasses RLS by design.

create table if not exists newsletter_subscribers (
  id uuid default gen_random_uuid() primary key,
  email text not null unique,
  created_at timestamptz default now()
);

alter table newsletter_subscribers enable row level security;

create policy "Anyone can subscribe"
  on newsletter_subscribers
  for insert
  to anon, authenticated
  with check (true);

-- DB-level format guard so even direct PostgREST inserts (anon key) can't
-- store junk that bypasses the app's zod validation.
alter table newsletter_subscribers
  add constraint newsletter_subscribers_email_format
  check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

comment on table newsletter_subscribers is 'Footer newsletter signups. Insert-only via RLS; admin list served server-side with the service-role key.';
