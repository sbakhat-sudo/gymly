import { supabase } from '@/lib/supabase/client';
import type { Band, Weekday } from '@/schemas';

/** One real hour of one real calendar date: what actually happened, never a forecast. `pct` is the
 * real occupancy percentage (check-ins ÷ the gym's own `capacity_reference`, the number the Manager
 * configures in "Gestione Capienza") — real and site-specific, never a static example value. */
export interface RealHourBand {
  dateKey: string;
  hour: number;
  band: Band;
  pct: number;
}

/**
 * The real week (`weekStartDateKey`..+6, Monday first) that `date_key` falls in, hour by hour. A
 * day that hasn't happened yet is simply absent from the result — nothing is guessed for it.
 */
export async function getWeekRealBands(siteId: string, weekStartDateKey: string): Promise<RealHourBand[]> {
  const { data, error } = await supabase.rpc('get_week_real_bands', { p_site_id: siteId, p_week_start: weekStartDateKey });
  if (error) throw error;
  return data.map((r) => ({ dateKey: r.date_key, hour: r.hour, band: r.band, pct: r.pct }));
}

/** Historical pattern for one weekday/hour across the last several weeks — not tied to any one real date. */
export interface WeeklyStat {
  weekday: Weekday;
  hour: number;
  band: Band;
  /** How many of the past occurrences of this weekday/hour actually had a check-in. */
  samples: number;
  /** Real occupancy percentage for this weekday/hour, averaged across those past occurrences. */
  pct: number;
}

export async function getWeeklyStats(siteId: string): Promise<WeeklyStat[]> {
  const { data, error } = await supabase.rpc('get_weekly_stats', { p_site_id: siteId });
  if (error) throw error;
  return data.map((r) => ({ weekday: r.weekday as Weekday, hour: r.hour, band: r.band, samples: r.samples, pct: r.pct }));
}
