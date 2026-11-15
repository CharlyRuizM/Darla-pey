begin;
create table public.office_charges (
  id uuid primary key default gen_random_uuid(),
  amount_cents integer not null check (amount_cents > 0),
  payment_link_id text unique,
  paid_at timestamptz,
  whatsapp_message_id text,
  created_at timestamptz not null default now()
);
alter table public.office_charges enable row level security;
revoke all on public.office_charges from public, anon, authenticated;
grant select, insert, update on public.office_charges to service_role;

create function public.reconcile_office_charge()
returns trigger language plpgsql set search_path = '' as $$
declare
  link_id text;
begin
  if tg_table_name = 'pey_webhook_events' then
    if new.payload->>'type' is distinct from 'payment_link.status_updated' then return new; end if;
    link_id := new.payload->>'paymentLinkId';
  else
    link_id := new.payment_link_id;
  end if;
  if link_id is null then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('office:' || link_id, 0));
  update public.office_charges c set paid_at = clock_timestamp()
  where c.payment_link_id = link_id and c.paid_at is null
    and exists (
      select 1
      from public.pey_webhook_events e
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(e.payload->'transactions') = 'array'
          then e.payload->'transactions' else '[]'::jsonb end
      ) t(payment)
      where e.payload->>'type' = 'payment_link.status_updated'
        and e.payload->>'paymentLinkId' = link_id
        and e.payload->>'clientReferenceId' = c.id::text
        and e.payload->>'status' = 'paid'
        and t.payment->>'paymentMethod' = 'CODI'
        and case when jsonb_typeof(t.payment->'amount') = 'number'
          then (t.payment->>'amount')::numeric * 100 = c.amount_cents else false end
    );
  return new;
end;
$$;
revoke all on function public.reconcile_office_charge() from public, anon, authenticated;
grant execute on function public.reconcile_office_charge() to service_role;
create trigger reconcile_office_charge_payment after insert on public.pey_webhook_events
  for each row execute function public.reconcile_office_charge();
create trigger reconcile_office_charge_link after update of payment_link_id on public.office_charges
  for each row execute function public.reconcile_office_charge();
commit;
