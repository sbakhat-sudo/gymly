import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { CheckIcon } from '@/components/icons';
import { useReduceMotion } from '@/lib/hooks';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { fontFamily, radius, spacing, useTheme, type Palette } from '@/lib/theme';

export type ManagerPlan = 'trial' | 'pro' | 'business';

export const PLAN_ORDER: ManagerPlan[] = ['trial', 'pro', 'business'];
export const PLAN_NAME_KEY: Record<ManagerPlan, TranslationKey> = {
  trial: 'admin.sites.plan.trial',
  pro: 'admin.sites.plan.pro',
  business: 'admin.sites.plan.business',
};
export const PLAN_PRICE_KEY: Record<ManagerPlan, TranslationKey> = {
  trial: 'managerSignup.plan.trial.price',
  pro: 'managerSignup.plan.pro.price',
  business: 'managerSignup.plan.business.price',
};
export const PLAN_FEATURES_KEY: Record<ManagerPlan, TranslationKey> = {
  trial: 'managerSignup.plan.trial.features',
  pro: 'managerSignup.plan.pro.features',
  business: 'managerSignup.plan.business.features',
};

/** `accent` is always one of the theme's plain `#rrggbb` tokens (see `planAccent`) — safe to tint for the selected fill. */
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Shared by the plan cards and the "MANAGER" badge, which borrows whichever plan's colour is
 * currently hovered/selected (see `ManagerBadge`) instead of carrying its own fixed colour. */
export function planAccent(plan: ManagerPlan, theme: Palette): string {
  return plan === 'trial' ? theme.textMuted : plan === 'pro' ? theme.primary : theme.band.amber.solid;
}

/** The "MANAGER" eyebrow pill — purely decorative (no action of its own). It borrows the colour of
 * whichever plan the pointer is currently over (or has picked), so it always reads as part of the
 * same choice rather than a fixed, unrelated label; idle (nothing hovered/picked) it's a neutral
 * brand tint. Shared by the signup plan picker and the "Hai una palestra?" section on Welcome. */
export function ManagerBadge({ activePlan }: { activePlan: ManagerPlan | null }) {
  const { t } = useI18n();
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(0));
  const accent = activePlan ? planAccent(activePlan, theme) : theme.primary;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: activePlan ? 1 : 0,
      duration: reduceMotion ? 0 : 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [activePlan, progress, reduceMotion]);

  const backgroundColor = progress.interpolate({ inputRange: [0, 1], outputRange: [hexToRgba(theme.primary, 0.14), accent] });
  const textColor = progress.interpolate({ inputRange: [0, 1], outputRange: [theme.primary, theme.onPrimary] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });

  return (
    <Animated.View style={{ alignSelf: 'flex-start', paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor, transform: [{ scale }] }}>
      <Animated.Text style={{ color: textColor, fontFamily: fontFamily.bodyBold, fontWeight: '800', fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase' }}>
        {t('managerSignup.badge')}
      </Animated.Text>
    </Animated.View>
  );
}

/** One plan's card: fills with its accent colour (lightly on hover, fully once picked, with a
 * spring pop and a checkmark), and fades the other cards once one is picked — selection/hover/dim
 * are all controlled by the parent so it can drive the shared `ManagerBadge` from the same state. */
export function PlanCard({
  plan,
  selected,
  dimmed,
  hovered,
  onHoverIn,
  onHoverOut,
  onPress,
}: {
  plan: ManagerPlan;
  selected: boolean;
  dimmed: boolean;
  hovered: boolean;
  onHoverIn: () => void;
  onHoverOut: () => void;
  onPress: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const features = t(PLAN_FEATURES_KEY[plan]).split('|');
  const accent = planAccent(plan, theme);

  const [selectProgress] = useState(() => new Animated.Value(0));
  const [hoverProgress] = useState(() => new Animated.Value(0));
  const [fadeProgress] = useState(() => new Animated.Value(1));

  useEffect(() => {
    Animated.timing(selectProgress, {
      toValue: selected ? 1 : 0,
      duration: reduceMotion ? 0 : 380,
      easing: Easing.out(Easing.back(1.6)),
      useNativeDriver: false,
    }).start();
  }, [selected, selectProgress, reduceMotion]);

  useEffect(() => {
    Animated.timing(fadeProgress, {
      toValue: dimmed ? 0.4 : 1,
      duration: reduceMotion ? 0 : 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [dimmed, fadeProgress, reduceMotion]);

  // Web/desktop pointer only (no-op on touch): a lighter preview of the selected look, so the
  // colour already hints at the plan before tapping it — ignored once a plan is chosen or dimmed.
  useEffect(() => {
    Animated.timing(hoverProgress, {
      toValue: hovered && !selected && !dimmed ? 1 : 0,
      duration: reduceMotion ? 0 : 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [hovered, selected, dimmed, hoverProgress, reduceMotion]);

  const highlight = Animated.add(selectProgress, hoverProgress).interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' });
  const borderColor = highlight.interpolate({ inputRange: [0, 1], outputRange: [theme.border, accent] });
  const backgroundColor = highlight.interpolate({ inputRange: [0, 1], outputRange: [theme.surface, hexToRgba(accent, 0.14)] });
  const scale = selectProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] });
  const checkScale = selectProgress.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });

  return (
    <Animated.View style={{ opacity: fadeProgress, transform: [{ scale: dimmed ? 0.97 : 1 }] }}>
      <Pressable
        onPress={onPress}
        onHoverIn={onHoverIn}
        onHoverOut={onHoverOut}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={t(PLAN_NAME_KEY[plan])}>
        <Animated.View
          style={{
            borderRadius: radius.card,
            padding: spacing.lg,
            gap: spacing.sm,
            backgroundColor,
            borderWidth: 2,
            borderColor,
            transform: [{ scale }],
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <AppText style={{ fontFamily: fontFamily.display, fontSize: 20 }}>{t(PLAN_NAME_KEY[plan])}</AppText>
              {selected ? (
                <Animated.View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: [{ scale: checkScale }],
                  }}>
                  <CheckIcon color={theme.onPrimary} size={13} strokeWidth={3} />
                </Animated.View>
              ) : null}
            </View>
            <AppText style={{ color: accent, fontWeight: '800', fontSize: 15 }}>{t(PLAN_PRICE_KEY[plan])}</AppText>
          </View>
          <View style={{ gap: 4 }}>
            {features.map((f) => (
              <AppText key={f} muted style={{ fontSize: 13 }}>
                {'•'} {f}
              </AppText>
            ))}
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}
