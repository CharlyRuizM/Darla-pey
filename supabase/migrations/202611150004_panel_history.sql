begin;

-- Leave existing rows null so their original creation time can be inferred.
alter table public.appointments add column created_at timestamptz;
alter table public.appointments alter column created_at set default now();

create index appointments_history_created_at on public.appointments (created_at desc, id desc);
create index panel_invitations_history_created_at on public.panel_invitations (created_at desc, id desc);
create index panel_invitations_history_appointment on public.panel_invitations (appointment_id) where appointment_id is not null;

create function public.panel_history(
  history_filter text, before_at timestamptz, before_key text
)
returns jsonb
language sql stable set search_path = ''
as $$
  with entries as (
    select 'appointment:' || a.id::text as entry_key, a.id,
      coalesce(a.created_at, a.hold_until - interval '6 hours') as sort_at,
      a.starts_at, a.hold_until, a.confirmed_at, a.deposit_cents,
      case when a.status = 'pending_payment' and a.hold_until <= now()
        then 'expired' else a.status end as status,
      right(a.whatsapp_phone, 4) as last4,
      a.created_at is null as estimated,
      i.id as invitation_id, i.status as invitation_status,
      i.created_at as invited_at, i.claimed_at as responded_at
    from public.appointments a
    left join lateral (
      select id, status, created_at, claimed_at from public.panel_invitations
      where appointment_id = a.id order by created_at desc, id desc limit 1
    ) i on true
    union all
    select 'invitation:' || i.id::text, i.id, i.created_at,
      i.slot_start, null, null, i.deposit_cents,
      case when i.status = 'sent' and i.slot_start <= now() + interval '6 hours'
        then 'expired' else i.status end,
      right(i.phone, 4), false, i.id, i.status, i.created_at, i.claimed_at
    from public.panel_invitations i
    where i.appointment_id is null
  ), page as (
    select * from entries e
    where (before_at is null or (e.sort_at, e.entry_key) < (before_at, before_key))
      and case history_filter
        when 'confirmed' then e.entry_key like 'appointment:%' and e.status = 'confirmed'
        when 'pending' then e.entry_key like 'appointment:%' and e.status = 'pending_payment'
        when 'closed' then e.status in ('expired', 'cancelled')
        when 'proposals' then e.invitation_id is not null
        when 'all' then true
        else false
      end
    order by e.sort_at desc, e.entry_key desc
    limit 31
  )
  select jsonb_build_object(
    'has_invitations', exists (select 1 from public.panel_invitations),
    'entries', coalesce((
      select jsonb_agg(to_jsonb(p) || jsonb_build_object('notices', coalesce((
        select jsonb_agg(jsonb_build_object('kind', n.kind, 'claimed_at', n.claimed_at,
          'created_at', n.created_at) order by n.created_at)
        from public.booking_notices n where p.entry_key like 'appointment:%' and n.appointment_id = p.id
      ), '[]'::jsonb)) order by p.sort_at desc, p.entry_key desc)
      from page p
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.panel_history(text,timestamptz,text) from public, anon, authenticated;
grant execute on function public.panel_history(text,timestamptz,text) to service_role;
commit;
