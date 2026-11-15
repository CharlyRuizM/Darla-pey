begin;
alter table public.panel_invitations drop constraint panel_invitations_phone_check,
  add constraint panel_invitations_phone_check check (phone ~ '^([0-9]{10}|\+[1-9][0-9]{6,14})$');
alter table public.appointments drop constraint appointments_whatsapp_phone_check,
  add constraint appointments_whatsapp_phone_check check (whatsapp_phone ~ '^[1-9][0-9]{6,14}$');
commit;
