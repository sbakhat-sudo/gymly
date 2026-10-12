import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, useWindowDimensions, View, type ViewStyle } from 'react-native';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';

import { AppText } from '@/components/AppText';
import { BandIcon } from '@/components/BandIcon';
import { ClockIcon, LogInIcon, StarFilledIcon } from '@/components/icons';
import { FadeSlideIn } from '@/components/FadeSlideIn';
import { LiveDot } from '@/components/LiveDot';
import { LogoMark, Wordmark } from '@/components/Logo';
import { Orb } from '@/components/Orb';
import { Screen } from '@/components/Screen';
import { LiveGauge } from '@/features/home/LiveGauge';
import { ManagerBadge, PLAN_FEATURES_KEY, PLAN_NAME_KEY, PLAN_ORDER, PLAN_PRICE_KEY, hexToRgba, planAccent, type ManagerPlan } from '@/features/auth/ManagerPlanCards';
import { decorativeA11yProps } from '@/lib/a11y';
import { useAppState } from '@/lib/app-state';
import { BAND_ORDER } from '@/lib/domain/band';
import { useReduceMotion } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { MIN_TAP, fontFamily, radius, spacing, useTheme, type Palette } from '@/lib/theme';

const CYCLE_MS = 3000;

function floatShadow(color: string): ViewStyle {
  return Platform.select<ViewStyle>({
    web: { boxShadow: `0 12px 30px -12px ${color}` } as ViewStyle,
    android: { elevation: 6 },
    default: { shadowColor: color, shadowOpacity: 0.35, shadowRadius: 15, shadowOffset: { width: 0, height: 12 } },
  });
}

/**
 * Benvenuto (Aurora): the first screen for a signed-out member. The dial and the floating chips are
 * an illustrated PREVIEW of the app — the band cycles Libera → Moderata → Affollata every 3 s and is
 * labelled as a preview for screen readers, so it never passes for a live reading of any gym.
 * Client pitch (this preview) → Manager pitch (`ManagerPlansSection`). "Accedi" up in the header
 * is the one shared sign-in entry point for either path.
 */
export function WelcomeScreen() {
  const { t, band: bandLabel } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const { setGuest, setDemo } = useAppState();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % BAND_ORDER.length), CYCLE_MS);
    return () => clearInterval(id);
  }, []);

  // A real desktop browser window, not just "running on web" — a narrow mobile browser still gets
  // the phone layout below. This is the one screen meant to read as an actual website on wide web.
  const isWide = width >= 900;
  const band = BAND_ORDER[index] ?? 'green';
  const colors = theme.band[band];

  const chips = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} {...decorativeA11yProps}>
      {BAND_ORDER.map((b) => {
        const active = b === band;
        return (
          <View
            key={b}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingVertical: 7,
              paddingHorizontal: 11,
              borderRadius: radius.pill,
              backgroundColor: active ? theme.band[b].soft : theme.glassBorder,
            }}>
            <BandIcon band={b} size={11} color={theme.band[b].solid} />
            <AppText color={active ? theme.band[b].onSoft : theme.textMuted} style={{ fontSize: 12, fontWeight: '600' }}>
              {bandLabel(b)}
            </AppText>
          </View>
        );
      })}
    </View>
  );

  const preview = (
    <View accessible accessibilityRole="image" accessibilityLabel={t('welcome.preview.a11y')} style={{ height: 318, alignItems: 'center', justifyContent: 'center' }}>
      {/* Scoped to this block (not the whole page) so it always lands behind the dial, in both the
          stacked (narrow) and side-by-side (wide) hero arrangement — a page-wide centred glow drifts
          off the dial as soon as the hero becomes a two-column row. */}
      <View {...decorativeA11yProps} pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Orb color={colors.solid} size={340} />
      </View>
      <View style={{ position: 'absolute' }}>
        <LiveGauge band={band} size={240} />
      </View>
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <BandIcon band={band} size={30} color={colors.solid} />
        <AppText style={{ fontFamily: fontFamily.display, fontSize: 36, lineHeight: 40, letterSpacing: 36 * -0.05 }}>{bandLabel(band)}</AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <LiveDot color={colors.solid} />
          <AppText muted style={{ fontFamily: fontFamily.mono, fontSize: 10, lineHeight: 13, letterSpacing: 10 * 0.12 }}>
            {t('home.live')}
          </AppText>
        </View>
      </View>

      <FloatChip style={{ top: 22, left: 0, transform: [{ rotate: '-5deg' }] }}>
        <BandIcon band="green" size={12} color={theme.band.green.solid} />
        <AppText style={{ fontSize: 13, fontWeight: '600' }}>{t('welcome.chip.zone', { band: bandLabel('green') })}</AppText>
      </FloatChip>
      <FloatChip fill={theme.accent} style={{ top: 70, right: -4, transform: [{ rotate: '6deg' }] }}>
        <StarFilledIcon color={theme.onAccent} size={13} />
        <AppText color={theme.onAccent} style={{ fontSize: 13, fontWeight: '700' }}>
          {t('welcome.chip.points')}
        </AppText>
      </FloatChip>
      <FloatChip style={{ bottom: 20, left: 14, paddingLeft: 8, transform: [{ rotate: '4deg' }] }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: theme.text, alignItems: 'center', justifyContent: 'center' }}>
          <LogInIcon color={theme.background} size={14} strokeWidth={2.6} />
        </View>
        <View>
          <AppText muted style={{ fontSize: 10, lineHeight: 13, fontWeight: '600' }}>
            {t('checkin.since')}
          </AppText>
          <AppText style={{ fontFamily: fontFamily.mono, fontSize: 13, lineHeight: 17 }}>00:42:18</AppText>
        </View>
      </FloatChip>
      <FloatChip fill={theme.primary} style={{ bottom: 44, right: 6, transform: [{ rotate: '-4deg' }] }}>
        <ClockIcon color={theme.onPrimary} size={13} strokeWidth={2.4} />
        <AppText color={theme.onPrimary} style={{ fontSize: 13, fontWeight: '600' }}>
          {t('welcome.chip.free')}
        </AppText>
      </FloatChip>
    </View>
  );

  const copy = (
    <View style={{ gap: spacing.md, paddingHorizontal: 6 }}>
      <AppText
        variant="headline"
        accessibilityRole="header"
        style={isWide ? { fontSize: 44, lineHeight: 48, letterSpacing: 44 * -0.06 } : { fontSize: 32, lineHeight: 35, letterSpacing: 32 * -0.06 }}>
        {t('welcome.title')}
      </AppText>
      <AppText muted style={isWide ? { fontSize: 17, lineHeight: 25, maxWidth: 440 } : { fontSize: 15, lineHeight: 21 }}>
        {t('welcome.body')}
      </AppText>
      {chips}
      <Pressable
        onPress={() => {
          setGuest(true);
          setDemo(true);
        }}
        accessibilityRole="button"
        style={({ pressed }) => ({
          marginTop: spacing.xs,
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          height: 48,
          paddingHorizontal: 20,
          borderRadius: radius.pill,
          borderWidth: 1.5,
          borderColor: theme.text,
          opacity: pressed ? 0.7 : 1,
        })}>
        <AppText style={{ fontWeight: '700', fontSize: 14 }}>{t('welcome.demo.cta')}</AppText>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={theme.text} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" {...decorativeA11yProps}>
          <Path d="M5 12h14M13 6l6 6-6 6" />
        </Svg>
      </Pressable>
    </View>
  );

  return (
    <Screen maxWidth={isWide ? 1180 : 720} bottomPadding={spacing.xxl}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: MIN_TAP, paddingHorizontal: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessible accessibilityRole="image" accessibilityLabel="Gymly">
          <LogoMark size={32} bgColor={theme.background} bandColor={colors.solid} />
          <Wordmark size={21} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable
            onPress={() => router.push('/(auth)/login')}
            accessibilityRole="button"
            hitSlop={4}
            style={{ height: 36, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: theme.glassBorder, justifyContent: 'center' }}>
            <AppText style={{ fontSize: 13, fontWeight: '600' }}>{t('auth.login.title')}</AppText>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(auth)/signup')}
            accessibilityRole="button"
            hitSlop={4}
            style={({ pressed }) => ({ height: 36, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: theme.primary, justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}>
            <AppText style={{ fontSize: 13, fontWeight: '700', color: theme.onPrimary }}>{t('auth.login.signupLink')}</AppText>
          </Pressable>
        </View>
      </View>

      {isWide ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xxl, marginTop: spacing.lg }}>
          <View style={{ flex: 1 }}>{copy}</View>
          <View style={{ flex: 1 }}>{preview}</View>
        </View>
      ) : (
        <>
          {preview}
          {copy}
        </>
      )}

      {Platform.OS === 'web' ? (
        <ManagerPlansSection isWide={isWide} />
      ) : (
        <View style={{ marginTop: spacing.xxl, paddingHorizontal: 6 }}>
          <View {...decorativeA11yProps} style={{ height: 1, backgroundColor: theme.border, marginBottom: spacing.lg }} />
          <AppText muted style={{ fontSize: 14, lineHeight: 20 }}>
            {t('welcome.manager.webOnly')}
          </AppText>
        </View>
      )}
    </Screen>
  );
}

/** "Hai una palestra?" — a compact pricing pitch for gym owners, tucked below the Client-facing
 * preview above. The cards are a dedicated "showcase" style (dark, gridded, glowing corner, one
 * big bold stat) rather than the functional picker reused in the signup flow — a landing page
 * sells the plan, it doesn't need the picker's select/dim mechanics. Picking one carries it
 * straight into signup (`?role=manager&plan=`), skipping that screen's own plan picker since the
 * choice is already made. */
function ManagerPlansSection({ isWide }: { isWide: boolean }) {
  const { t } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const [hoveredPlan, setHoveredPlan] = useState<ManagerPlan | null>(null);

  return (
    <View style={{ gap: spacing.lg, marginTop: spacing.xxl, paddingHorizontal: 6 }}>
      <View {...decorativeA11yProps} style={{ height: 1, backgroundColor: theme.border }} />

      <View style={{ gap: 10 }}>
        <ManagerBadge activePlan={hoveredPlan} />
        <AppText variant="headline" style={isWide ? { fontSize: 32, lineHeight: 36, letterSpacing: 32 * -0.05 } : { fontSize: 26, lineHeight: 30, letterSpacing: 26 * -0.05 }}>
          {t('welcome.plans.title')}
        </AppText>
        <AppText muted style={isWide ? { fontSize: 16, lineHeight: 23, maxWidth: 520 } : { fontSize: 14, lineHeight: 20 }}>
          {t('welcome.plans.subtitle')}
        </AppText>
      </View>

      <View style={{ flexDirection: isWide ? 'row' : 'column', gap: spacing.md }}>
        {PLAN_ORDER.map((p, i) => (
          // `flex: 1` has to sit on the row's DIRECT child to do anything — only a flex container's
          // immediate children compete for its leftover space. It was previously one level too deep,
          // inside FadeSlideIn's own wrapper View, which itself never grew — so each card just sized
          // to its own content (Business's longer price/pitch text) instead of splitting the row
          // evenly. `minWidth: 0` alongside it lets a card actually shrink below its content's
          // natural width, which a flex item refuses to do by default.
          <View key={p} style={isWide ? { flex: 1, minWidth: 0 } : undefined}>
            <FadeSlideIn delay={i * 90}>
              <PlanShowcaseCard
                plan={p}
                onHoverIn={() => setHoveredPlan(p)}
                onHoverOut={() => setHoveredPlan((h) => (h === p ? null : h))}
                onPress={() => router.push(`/(auth)/signup?role=manager&plan=${p}`)}
              />
            </FadeSlideIn>
          </View>
        ))}
      </View>
    </View>
  );
}

/** The CTA pill's text/icon colour needs real contrast against its own solid `accent` fill
 * (unlike the badge, which only ever tints that colour at low alpha) — reuses the same
 * contrast-checked "on-colour" tokens the rest of the app already relies on. */
function ctaOnAccent(plan: ManagerPlan, theme: Palette): string {
  if (plan === 'trial') return '#0B0F1A';
  if (plan === 'pro') return theme.onPrimary;
  return theme.band.amber.onSolid;
}

/** A dark, gridded "SaaS pricing" card — the plan name as a small pill, the price as one big bold
 * stat, a one-line pitch, and a dedicated "Inizia" button, with a breathing colour glow in the
 * corner (reuses `Orb`) that brightens further on hover/press. The dark background and grid are
 * fixed (not tied to light/dark theme) — that contrast against the page is what makes it read as a
 * showcase piece rather than just another card in the list. Colour (the pill, the glow, the price,
 * the button) still follows each plan's own accent via `planAccent`. */
function PlanShowcaseCard({
  plan,
  onHoverIn,
  onHoverOut,
  onPress,
}: {
  plan: ManagerPlan;
  onHoverIn: () => void;
  onHoverOut: () => void;
  onPress: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const accent = planAccent(plan, theme);
  const pitch = t(PLAN_FEATURES_KEY[plan]).split('|')[0];
  const gridId = `plan-grid-${plan}`;

  const [hovered, setHovered] = useState(false);
  const [hoverProgress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(hoverProgress, {
      toValue: hovered ? 1 : 0,
      duration: reduceMotion ? 0 : 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [hovered, hoverProgress, reduceMotion]);

  const borderColor = hoverProgress.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0.08)', accent] });
  const scale = hoverProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.015] });
  const glowOpacity = hoverProgress.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });

  return (
    <Pressable
      onHoverIn={() => {
        setHovered(true);
        onHoverIn();
      }}
      onHoverOut={() => {
        setHovered(false);
        onHoverOut();
      }}
      style={{ flex: 1, minWidth: 0 }}>
      <Animated.View style={{ flex: 1, minWidth: 0, borderRadius: radius.card, overflow: 'hidden', backgroundColor: '#0B0F1A', borderWidth: 1, borderColor, transform: [{ scale }] }}>
        <Svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }} {...decorativeA11yProps}>
          <Defs>
            <Pattern id={gridId} width={22} height={22} patternUnits="userSpaceOnUse">
              <Path d="M 22 0 L 0 0 0 22" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${gridId})`} />
        </Svg>
        <Animated.View style={{ position: 'absolute', top: -50, right: -50, opacity: glowOpacity }}>
          <Orb color={accent} size={170} />
        </Animated.View>

        {/* `justifyContent: space-between` pins the CTA to the bottom edge no matter how long each
            plan's pitch line runs, so all three cards' buttons always land on the same row. */}
        <View style={{ flex: 1, padding: spacing.lg, justifyContent: 'space-between' }}>
          <View style={{ gap: spacing.md }}>
            <View
              style={{
                alignSelf: 'flex-start',
                paddingHorizontal: spacing.md,
                paddingVertical: 6,
                borderRadius: radius.pill,
                backgroundColor: hexToRgba(accent, 0.16),
                borderWidth: 1,
                borderColor: hexToRgba(accent, 0.4),
              }}>
              <AppText style={{ color: accent, fontWeight: '800', fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                {t(PLAN_NAME_KEY[plan])}
              </AppText>
            </View>
            <AppText style={{ color: '#FFFFFF', fontFamily: fontFamily.display, fontSize: 32, lineHeight: 36 }}>{t(PLAN_PRICE_KEY[plan])}</AppText>
            <AppText style={{ color: 'rgba(255,255,255,0.68)', fontSize: 13, lineHeight: 18 }}>{pitch}</AppText>
          </View>

          <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`${t('welcome.plans.cta')} — ${t(PLAN_NAME_KEY[plan])}`}
            style={({ pressed }) => ({
              marginTop: spacing.md,
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: spacing.lg,
              paddingVertical: 11,
              borderRadius: radius.pill,
              backgroundColor: accent,
              opacity: pressed ? 0.85 : 1,
            })}>
            <AppText style={{ color: ctaOnAccent(plan, theme), fontWeight: '800', fontSize: 13 }}>{t('welcome.plans.cta')}</AppText>
            <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={ctaOnAccent(plan, theme)} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" {...decorativeA11yProps}>
              <Path d="M5 12h14M13 6l6 6-6 6" />
            </Svg>
          </Pressable>
        </View>
      </Animated.View>
    </Pressable>
  );
}

/** A tilted pill floating over the preview dial: glass by default, or a solid brand fill. */
function FloatChip({ children, fill, style }: { children: ReactNode; fill?: string; style: ViewStyle }) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          position: 'absolute',
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingVertical: 9,
          paddingHorizontal: 13,
          borderRadius: 16,
          backgroundColor: fill ?? theme.surface,
          borderWidth: fill ? 0 : 1,
          borderColor: theme.glassBorder,
        },
        floatShadow(fill ?? '#000000'),
        style,
      ]}>
      {children}
    </View>
  );
}
