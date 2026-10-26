-- Same hardening as 20261104060000_owner_get_overview_revoke_anon.sql, for the Owner plan-card
-- objects: trigger functions are never meant to be called as RPCs, and nothing here is for `anon`.
revoke execute on function public.site_plan_cards_manager_guard() from public, anon, authenticated;
revoke execute on function public.sites_mirror_owner_cards() from public, anon, authenticated;
revoke execute on function public.get_managers_can_create_cards() from anon;
revoke execute on function public.owner_create_plan_card(text, text) from anon;
revoke execute on function public.owner_update_plan_card(uuid, text, text) from anon;
revoke execute on function public.owner_set_plan_card_active(uuid, boolean) from anon;
revoke execute on function public.owner_delete_plan_card(uuid) from anon;
revoke execute on function public.owner_set_managers_can_create_cards(boolean) from anon;
