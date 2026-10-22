import { useIsFocused } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react';

type IconType = (p: { color: string; size: number }) => ReactElement;

export type PageHeader = { icon: IconType; label: string } | { node: ReactNode };

interface PageHeaderContextValue {
  header: PageHeader | null;
  setHeader: (header: PageHeader | null) => void;
}

const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

function headersEqual(a: PageHeader | null, b: PageHeader | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if ('node' in a || 'node' in b) return 'node' in a && 'node' in b && a.node === b.node;
  return a.icon === b.icon && a.label === b.label;
}

/** Holds whichever screen's title is currently "active", for `RoleTopBar` to render fixed above
 * every screen (sidebar mode only — see `usePageHeader`). One per role layout, wrapping `<Tabs>`.
 *
 * `setHeader` bails out (keeps the same `header` object) when the incoming value is equal to the
 * current one by content, not just by reference — `usePageHeader` below calls it with a brand-new
 * `{icon, label}` object literal on every run, even when `icon`/`label` haven't actually changed,
 * so without this bail-out `header` would change reference every time regardless, which previously
 * closed a real infinite loop: `header` changing → this Provider's memoized `value` changing →
 * every consumer (including whichever screen's own `usePageHeader` just wrote that same header)
 * re-rendering → its effect re-running because its own `ctx` dependency just changed → writing
 * again → forever. The content check here is what actually breaks that cycle; the context value
 * memo below is just the (still worthwhile) second half of not re-rendering needlessly. */
export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeaderState] = useState<PageHeader | null>(null);
  const setHeader = useCallback((next: PageHeader | null) => {
    setHeaderState((prev) => (headersEqual(prev, next) ? prev : next));
  }, []);
  const value = useMemo(() => ({ header, setHeader }), [header, setHeader]);
  return <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>;
}

/**
 * A screen calls this (via `ScreenHeader`, not directly) to register its own title+icon as the one
 * `RoleTopBar` should show. Expo Router's Tabs navigator keeps every tab's screen mounted at once
 * (hidden, not unmounted) when switching tabs — so this only writes to the shared context while
 * `useIsFocused()` says this particular screen is the visible one; otherwise every mounted screen
 * would be racing to overwrite the same header with its own title. No cleanup on blur/unmount: the
 * next screen to focus simply overwrites it, same as a real navigation header would update.
 */
export function usePageHeader(icon: IconType, label: string): void {
  const ctx = useContext(PageHeaderContext);
  const focused = useIsFocused();
  useEffect(() => {
    if (!ctx || !focused) return;
    ctx.setHeader({ icon, label });
  }, [ctx, focused, icon, label]);
}

/**
 * Same idea as `usePageHeader`, for the rare screen whose own header isn't a plain icon+label —
 * `ManagerSituationScreen`'s gym logo + live name, which already carries more meaning than a
 * generic "Situazione" label would. `node` should stay referentially stable (e.g. built with
 * `useMemo`) or this will needlessly re-register on every render.
 */
export function usePageHeaderNode(node: ReactNode): void {
  const ctx = useContext(PageHeaderContext);
  const focused = useIsFocused();
  useEffect(() => {
    if (!ctx || !focused) return;
    ctx.setHeader({ node });
  }, [ctx, focused, node]);
}

/** Read-only side: `RoleTopBar` renders whatever the currently-focused screen last registered. */
export function useActivePageHeader(): PageHeader | null {
  const ctx = useContext(PageHeaderContext);
  return ctx?.header ?? null;
}
