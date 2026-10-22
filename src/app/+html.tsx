import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Root web shell (Expo Router's static-rendering hook) — the one place to customize `<head>`.
 * Only purpose today: a favicon that's just the line-art dumbbell mark, transparent background, no
 * background tile — one dark-line variant for a light browser tab, one light-line variant for a
 * dark one, picked automatically via `prefers-color-scheme` (same shape/stroke as `DumbbellIcon`,
 * src/components/icons.tsx — kept in sync by eye, there's no build step that generates one from the
 * other). The plain, unconditional link is the fallback for a browser that ignores `media` on
 * `<link rel="icon">`.
 *
 * Note: this file only runs for a static web export (`npx expo export -p web`) — the `npx expo
 * start` dev server serves its own generic HTML shell and never renders this component, so anything
 * added here (confirmed empirically: even the favicon links above are absent from the dev server's
 * served HTML) is invisible until a real export/deploy. The global focused-input style fix lives in
 * `app/_layout.tsx` instead (a runtime effect, not an HTML template) specifically so it also works
 * in the dev server, where it's actually tested.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
        <link rel="icon" href="/favicon-light.png" />
        <link rel="icon" href="/favicon-light.png" media="(prefers-color-scheme: light)" />
        <link rel="icon" href="/favicon-dark.png" media="(prefers-color-scheme: dark)" />
      </head>
      <body>{children}</body>
    </html>
  );
}
