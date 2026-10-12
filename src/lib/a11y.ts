import { Platform } from 'react-native';

/**
 * Marks a purely decorative element as hidden from assistive technology, on native only.
 * `accessibilityElementsHidden` (iOS) and `importantForAccessibility="no-hide-descendants"`
 * (Android) are React Native props with no DOM equivalent: react-native-svg's web renderer spreads
 * unknown props straight onto the DOM node (see its `prepare()` util), so passing them there
 * produces a React console warning ("does not recognize the `X` prop on a DOM element") instead of
 * actually hiding anything — and plain `View`/`Text` don't recognise them either (react-native-web
 * only maps its own `accessibilityHidden`/`aria-hidden`, a different, untyped prop name). On web
 * the decorative element is simply left out of this treatment; the real accessible label always
 * lives on the enclosing Pressable/View, so nothing meaningful is lost.
 */
export const decorativeA11yProps =
  Platform.OS === 'web'
    ? {}
    : ({ accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const);
