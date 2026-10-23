import { supabase } from './client';

/** The (fixed) name of the gym a Manager, Coach or Client belongs to — read-only everywhere it is shown;
 * the Owner decides it once and every site under them carries it. `sites` is readable by any signed-in
 * user (a site's name and address are public to its own members). */
export async function getSiteName(siteId: string): Promise<string | null> {
  const { data, error } = await supabase.from('sites').select('name').eq('site_id', siteId).maybeSingle();
  if (error) throw error;
  return data?.name ?? null;
}
