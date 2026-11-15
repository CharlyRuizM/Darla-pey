begin;

create table public.panel_invitations (
  id uuid primary key default gen_random_uuid(),
  phone text not null check (phone ~ '^[0-9]{10}$'),
  slot_start timestamptz not null,
  deposit_cents integer not null check (deposit_cents between 1 and 100000000),
  status text not null check (status in ('sent','accepted','rejected','reschedule_requested','failed','expired')),
  appointment_id uuid references public.appointments(id),
  whatsapp_message_id text,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

create index panel_invitations_sent_slots on public.panel_invitations(slot_start)
  where status = 'sent';

create table public.panel_whatsapp_contacts (
  phone text primary key check (phone ~ '^[0-9]{10}$'),
  recipient text not null check (recipient ~ '^52(1)?[0-9]{10}$'),
  last_inbound_at timestamptz not null,
  check (right(recipient, 10) = phone)
);

alter table public.panel_invitations enable row level security;
alter table public.panel_whatsapp_contacts enable row level security;
revoke all on public.panel_invitations, public.panel_whatsapp_contacts from public, anon, authenticated;
grant select, insert, update on public.panel_invitations, public.panel_whatsapp_contacts to service_role;

create function public.record_panel_whatsapp_contact(contact_phone text, contact_recipient text, inbound_at timestamptz)
returns void language sql set search_path = '' as $$
  insert into public.panel_whatsapp_contacts (phone, recipient, last_inbound_at)
  values (contact_phone, contact_recipient, inbound_at)
  on conflict (phone) do update set
    recipient = excluded.recipient, last_inbound_at = excluded.last_inbound_at
  where panel_whatsapp_contacts.last_inbound_at < excluded.last_inbound_at;
$$;
revoke all on function public.record_panel_whatsapp_contact(text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.record_panel_whatsapp_contact(text,text,timestamptz) to service_role;

commit;
