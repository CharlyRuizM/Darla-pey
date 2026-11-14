begin;

alter table public.appointments alter column pey_transaction_id drop not null;

create trigger reconcile_appointment_after_transaction_link
after update of pey_transaction_id on public.appointments
for each row
when (old.pey_transaction_id is distinct from new.pey_transaction_id)
execute function public.reconcile_pey_appointment();

create function public.reserve_dental_appointment(
  reservation_id uuid, slot_start timestamptz, amount_cents integer
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  current_time_at_reservation timestamptz;
  local_start timestamp := slot_start at time zone 'America/Mexico_City';
  weekday integer := extract(isodow from local_start);
begin
  perform pg_catalog.pg_advisory_xact_lock(184302, 1);
  current_time_at_reservation := clock_timestamp();

  if slot_start <= current_time_at_reservation + interval '6 hours'
    or weekday = 7
    or local_start::time < (case when weekday = 6 then time '11:00' else time '10:00' end)
    or (local_start + interval '45 minutes')::time >
      (case when weekday = 6 then time '15:00' else time '19:00' end)
    or local_start::date <> (local_start + interval '45 minutes')::date
  then
    return false;
  end if;

  if exists (
    select 1 from public.appointments
    where (status = 'confirmed' or
          (status = 'pending_payment' and hold_until > current_time_at_reservation))
      and starts_at < slot_start + interval '45 minutes'
      and starts_at + interval '45 minutes' > slot_start
  ) then
    return false;
  end if;

  insert into public.appointments (id, starts_at, hold_until, deposit_cents)
  values (reservation_id, slot_start, current_time_at_reservation + interval '6 hours', amount_cents)
  on conflict (id) do nothing;
  return found;
end;
$$;

revoke all on function public.reserve_dental_appointment(uuid, timestamptz, integer)
from public, anon, authenticated;
grant execute on function public.reserve_dental_appointment(uuid, timestamptz, integer)
to service_role;

commit;
