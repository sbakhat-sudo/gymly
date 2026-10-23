-- A real "Elimina" for a plan card — until now only Attiva/Disattiva existed (the original design
-- avoided a hard delete because `subscriptions.card_id` references the card, see
-- 20261103040000_manager_plan_cards.sql's own comment), but the Manager asked for a real delete.
-- Any subscription still linked to this card is detached first (`card_id = null`) rather than left
-- to violate the foreign key or cascade-deleted: the subscriber keeps their own already-snapshotted
-- name/price/duration/description/tier exactly as last synced — deleting the card just means it can
-- no longer push further live updates to them (the same end state as if it had simply never existed
-- for a legacy/pre-card row).
create function public.manager_delete_plan_card(p_card_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_site_id text;
begin
  select site_id into v_site_id from public.profiles where id = auth.uid() and role = 'manager';
  if v_site_id is null then
    raise exception 'not a manager';
  end if;
  if not exists (select 1 from public.site_plan_cards where id = p_card_id and site_id = v_site_id) then
    raise exception 'not authorized';
  end if;

  update public.subscriptions set card_id = null where card_id = p_card_id;
  delete from public.site_plan_cards where id = p_card_id and site_id = v_site_id;
end;
$$;

revoke all on function public.manager_delete_plan_card(uuid) from public;
grant execute on function public.manager_delete_plan_card(uuid) to authenticated;
