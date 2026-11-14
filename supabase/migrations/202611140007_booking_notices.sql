begin;
alter table public.appointments add column whatsapp_phone text
  check (whatsapp_phone ~ '^52[0-9]{10}$');

create table public.booking_notices (
  appointment_id uuid not null references public.appointments(id),
  kind text not null check (kind in ('pending_payment', 'confirmed', 'expired')),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  primary key (appointment_id, kind)
);
alter table public.booking_notices enable row level security;
revoke all on public.booking_notices from public, anon, authenticated;
grant select, insert, update on public.booking_notices to service_role;

create function public.queue_booking_notice()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.whatsapp_phone is not null and new.pey_transaction_id is not null
    and new.status in ('pending_payment', 'confirmed', 'expired') then
    insert into public.booking_notices (appointment_id, kind)
      values (new.id, new.status) on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger queue_booking_notice
after update of status, pey_transaction_id on public.appointments
for each row execute function public.queue_booking_notice();

create function public.expire_booking_holds()
returns void language sql set search_path = '' as $$
  update public.appointments set status = 'expired'
  where status = 'pending_payment' and hold_until <= now();
$$;
revoke all on function public.expire_booking_holds() from public, anon, authenticated;
grant execute on function public.expire_booking_holds() to service_role;
commit;
