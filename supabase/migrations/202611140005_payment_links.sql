begin;

create index pey_webhook_events_payment_link_idx
  on public.pey_webhook_events ((payload->>'paymentLinkId'))
  where payload->>'type' = 'payment_link.status_updated';

create or replace function public.reconcile_pey_appointment()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  transaction_id text;
begin
  if tg_table_name = 'pey_webhook_events' then
    case new.payload->>'type'
      when 'codi.pn.payment_received' then transaction_id := new.payload->>'transactionId';
      when 'payment_link.status_updated' then transaction_id := 'link:' || (new.payload->>'paymentLinkId');
      else return new;
    end case;
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
      where event.received_at < appointment.hold_until
        and (
          (event.payload->>'type' = 'codi.pn.payment_received'
           and event.payload->>'transactionId' = transaction_id
           and left(transaction_id, 5) <> 'link:'
           and case when jsonb_typeof(event.payload->'amount') = 'number'
             then (event.payload->>'amount')::numeric * 100 = appointment.deposit_cents
             else false end)
          or
          (event.payload->>'type' = 'payment_link.status_updated'
           and 'link:' || (event.payload->>'paymentLinkId') = transaction_id
           and event.payload->>'status' = 'paid'
           and event.payload->>'clientReferenceId' = appointment.id::text
           and exists (
             select 1 from jsonb_array_elements(
               case when jsonb_typeof(event.payload->'transactions') = 'array'
               then event.payload->'transactions' else '[]'::jsonb end
             ) as settled(payment)
             where payment->>'paymentMethod' = 'CODI'
               and case when jsonb_typeof(payment->'amount') = 'number'
                 then (payment->>'amount')::numeric * 100 = appointment.deposit_cents
                 else false end
           ))
        )
    );

  return new;
end;
$$;

commit;
