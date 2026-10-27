-- "Add Manager" failed with "Could not choose the best candidate function": two versions of
-- owner_create_manager_record() existed side by side. The 6-argument one is the original, kept by mistake when a
-- later migration added `p_phone` (a different argument list creates a new function instead of replacing it). It
-- also predates the chain's fixed gym name and plan. Only the current 7-argument version stays.
drop function if exists public.owner_create_manager_record(uuid, text, text, text, double precision, double precision);

notify pgrst, 'reload schema';
