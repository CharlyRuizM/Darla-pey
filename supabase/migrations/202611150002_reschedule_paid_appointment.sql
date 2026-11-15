begin;

create function public.reschedule_paid_appointment(
  booking_id uuid, booking_phone text, new_start timestamptz
)
returns boolean language plpgsql set search_path = '' as $$
declare
  current_time_at_move timestamptz;
  local_start timestamp := new_start at time zone 'America/Mexico_City';
  weekday integer := extract(isodow from local_start);
begin
  perform pg_catalog.pg_advisory_xact_lock(184302, 1);
  current_time_at_move := clock_timestamp();

  if new_start is null
    or new_start <= current_time_at_move + interval '6 hours'
    or weekday = 7
    or date_trunc('hour', local_start) <> local_start
    or local_start::time < (case when weekday = 6 then time '11:00' else time '10:00' end)
    or local_start::time >= (case when weekday = 6 then time '15:00' else time '19:00' end)
  then
    return false;
  end if;

  if exists (
    select 1 from public.appointments
    where id <> booking_id
      and (status = 'confirmed' or (status = 'pending_payment' and hold_until > current_time_at_move))
      and starts_at < new_start + interval '60 minutes'
      and starts_at + interval '60 minutes' > new_start
  ) then
    return false;
  end if;

  update public.appointments
  set starts_at = new_start, hold_until = least(hold_until, new_start - interval '1 second')
  where id = booking_id and whatsapp_phone = booking_phone
    and status = 'confirmed' and confirmed_at is not null
    and starts_at >= current_time_at_move + interval '24 hours'
    and starts_at <> new_start;
  return found;
end;
$$;
revoke all on function public.reschedule_paid_appointment(uuid,text,timestamptz) from public, anon, authenticated;
grant execute on function public.reschedule_paid_appointment(uuid,text,timestamptz) to service_role;
commit;
