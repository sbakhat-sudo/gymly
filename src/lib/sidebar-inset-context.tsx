import { createContext, useContext, type ReactNode } from 'react';

const SidebarInsetContext = createContext(0);

/** Reserves horizontal room on `Screen`'s left edge for the sidebar nav drawn by `PillTabBar` in
 * sidebar mode — the sidebar itself paints as an absolute overlay (same idiom as the floating
 * bottom pill bar), so screens need a separate signal to avoid their content starting underneath
 * it. Each of (manager)/(coach)/(admin)'s `_layout.tsx` provides this; everywhere else it's 0. */
export function SidebarInsetProvider({ width, children }: { width: number; children: ReactNode }) {
  return <SidebarInsetContext.Provider value={width}>{children}</SidebarInsetContext.Provider>;
}

export function useSidebarInset(): number {
  return useContext(SidebarInsetContext);
}
