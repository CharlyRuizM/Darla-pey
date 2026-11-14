create table public.pey_webhook_events (
  webhook_id text primary key,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

alter table public.pey_webhook_events enable row level security;
revoke all on public.pey_webhook_events from public, anon, authenticated;
grant select, insert on public.pey_webhook_events to service_role;
