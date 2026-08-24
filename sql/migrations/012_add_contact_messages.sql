-- Contact Us form messages ("Say hi" page).
-- RLS: anonymous/authenticated clients may INSERT only — no SELECT/UPDATE/DELETE
-- from the client. Admin reads/status updates go through the service-role
-- server client (getSupabaseServer()), which bypasses RLS by design.

create table if not exists contact_messages (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text not null,
  message text not null,
  status text not null default 'new',
  created_at timestamptz default now()
);

alter table contact_messages enable row level security;

create policy "Anyone can send a contact message"
  on contact_messages
  for insert
  to anon, authenticated
  with check (true);

-- DB-level guards so even direct PostgREST inserts (anon key) can't store
-- junk that bypasses the app's zod validation, and status stays a known value.
alter table contact_messages
  add constraint contact_messages_email_format
  check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');
alter table contact_messages
  add constraint contact_messages_name_length
  check (char_length(name) between 1 and 100);
alter table contact_messages
  add constraint contact_messages_message_length
  check (char_length(message) between 1 and 2000);
alter table contact_messages
  add constraint contact_messages_status_allowed
  check (status in ('new', 'read'));

create index if not exists idx_contact_messages_created_at
  on contact_messages (created_at desc);

comment on table contact_messages is 'Contact form submissions. Insert-only via RLS; admin list/mark-read served server-side with the service-role key.';
