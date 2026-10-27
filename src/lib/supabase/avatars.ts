import { useEffect, useState } from 'react';

import { logger } from '@/lib/logger';

import { supabase } from './client';

/**
 * Profile photos by person, for lists whose own data does not carry one (the activity feed, the Admin's owners, the
 * Owner's managers/clients/coaches, subscriptions, requests, messages). One short batch per burst of rows: every
 * `useAvatarUrl` asked for in the same moment is answered by a single `profiles` read, and the answer is kept so a row
 * that scrolls back never asks again. Row-level security decides who can be seen; a photo that cannot be read (or a
 * failed lookup) simply stays the initials — a photo is never a reason for a list to fail.
 */
const cache = new Map<string, string | null>();
const waiting = new Map<string, ((url: string | null) => void)[]>();
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush(): Promise<void> {
  timer = null;
  const batch = [...waiting.entries()];
  waiting.clear();
  const ids = batch.map(([id]) => id);
  const found = new Map<string, string | null>();
  let ok = false;
  try {
    const { data, error } = await supabase.from('profiles').select('id, avatar_url').in('id', ids);
    if (error) throw error;
    for (const row of data) found.set(row.id, row.avatar_url);
    ok = true;
  } catch (e) {
    logger.error('avatars.lookup_failed', e);
  }
  for (const [id, callbacks] of batch) {
    const url = found.get(id) ?? null;
    // A failed lookup is not remembered, so the next time the row shows it tries again.
    if (ok) cache.set(id, url);
    for (const cb of callbacks) cb(url);
  }
}

function request(id: string, cb: (url: string | null) => void): void {
  const list = waiting.get(id);
  if (list) list.push(cb);
  else waiting.set(id, [cb]);
  timer ??= setTimeout(() => void flush(), 30);
}

/** Forget what was learned about a person's photo (after they change it). */
export function forgetAvatar(userId: string): void {
  cache.delete(userId);
}

/** The photo URL of `userId`, or `null` (initials) while unknown / when there is none. */
export function useAvatarUrl(userId: string | null | undefined): string | null {
  const [loaded, setLoaded] = useState<{ id: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!userId || cache.has(userId)) return;
    let alive = true;
    request(userId, (url) => {
      if (alive) setLoaded({ id: userId, url });
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  if (!userId) return null;
  if (cache.has(userId)) return cache.get(userId) ?? null;
  return loaded && loaded.id === userId ? loaded.url : null;
}
