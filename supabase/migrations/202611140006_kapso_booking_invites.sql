create table public.kapso_booking_invites (
  message_id text primary key,
  created_at timestamptz not null default now()
);
alter table public.kapso_booking_invites enable row level security;
revoke all on public.kapso_booking_invites from public, anon, authenticated;
grant select, insert on public.kapso_booking_invites to service_role;
