import { useEffect } from 'react';

import { ALERT_PRESETS, DEFAULT_ALERT_PRESET, shouldSendGreenAlert } from '@/lib/domain/alerts';
import { localTime } from '@/lib/domain/time';
import type { Lang } from '@/lib/i18n';
import { sendGreenAlert } from '@/lib/notifications';
import { useClock } from '@/lib/services-context';
import { storage } from '@/lib/storage';

/**
 * Fires the local "your gym is quiet now" alert. It can only ever run while the app is open (no
 * background work exists), and only when a FRESH, live, non-offline reading says green right now.
 * `readingKey` identifies that reading (its `observed_at`); null = nothing to alert about.
 * Limits (opt-in, chosen window, quiet hours 22–08, once a day) live in `shouldSendGreenAlert`.
 */
export function useGreenAlert(readingKey: string | null, site: { name: string; timezone: string }, lang: Lang): void {
  const clock = useClock();
  useEffect(() => {
    if (readingKey === null) return;
    let alive = true;
    void (async () => {
      const [optedIn, window, lastAlertDate] = await Promise.all([
        storage.get('alertOptIn'),
        storage.get('alertWindow'),
        storage.get('lastAlertDate'),
      ]);
      if (!alive) return;
      const local = localTime(clock.now(), site.timezone);
      const allowed = shouldSendGreenAlert({
        optedIn: optedIn === true,
        band: 'green',
        localMinutes: local.minutes,
        localDateKey: local.dateKey,
        window: window ?? ALERT_PRESETS[DEFAULT_ALERT_PRESET],
        lastAlertDateKey: lastAlertDate,
      });
      if (!allowed) return;
      if (await sendGreenAlert(lang, site.name)) await storage.set('lastAlertDate', local.dateKey);
    })();
    return () => {
      alive = false;
    };
  }, [readingKey, clock, site.name, site.timezone, lang]);
}
