begin;

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  hold_until timestamptz not null,
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'confirmed', 'expired', 'cancelled')),
  pey_transaction_id text not null unique,
  deposit_cents integer not null check (deposit_cents > 0),
  confirmed_at timestamptz,
  check (hold_until < starts_at)
);

alter table public.appointments enable row level security;
revoke all on public.appointments from public, anon, authenticated;
grant select, insert, update on public.appointments to service_role;

create index pey_webhook_events_payment_transaction_idx
  on public.pey_webhook_events ((payload->>'transactionId'))
  where payload->>'type' = 'codi.pn.payment_received';

-- Run from both sides because pey can deliver before the appointment is linked.
create function public.reconcile_pey_appointment()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  transaction_id text;
begin
  if tg_table_name = 'pey_webhook_events' then
    if new.payload->>'type' is distinct from 'codi.pn.payment_received' then
      return new;
    end if;
    transaction_id := new.payload->>'transactionId';
  else
    transaction_id := new.pey_transaction_id;
  end if;

  if transaction_id is null or transaction_id = '' then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(transaction_id, 0));

  update public.appointments as appointment
  set status = 'confirmed', confirmed_at = pg_catalog.clock_timestamp()
  where appointment.pey_transaction_id = transaction_id
    and appointment.status = 'pending_payment'
    and appointment.hold_until > pg_catalog.clock_timestamp()
    and exists (
      select 1
      from public.pey_webhook_events as event
      where event.payload->>'transactionId' = transaction_id
        and event.payload->>'type' = 'codi.pn.payment_received'
        and event.received_at < appointment.hold_until
        and case when pg_catalog.jsonb_typeof(event.payload->'amount') = 'number'
          then (event.payload->>'amount')::numeric * 100 = appointment.deposit_cents
          else false end
    );

  return new;
end;
$$;

revoke all on function public.reconcile_pey_appointment() from public, anon, authenticated;
grant execute on function public.reconcile_pey_appointment() to service_role;

create trigger reconcile_appointment_after_payment
after insert on public.pey_webhook_events
for each row execute function public.reconcile_pey_appointment();

create trigger reconcile_appointment_after_link
after insert on public.appointments
for each row execute function public.reconcile_pey_appointment();

commit;
