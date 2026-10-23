import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { CheckIcon, ChevronRightIcon, ClockIcon, CreditCardIcon } from '@/components/icons';
import { useReduceMotion } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { CARD_SHADOW } from '@/lib/card-shadow';
import { fontFamily, radius, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';

import { choosePlan, getAvailablePlanCards, type PlanCard } from './billing-api';
import { PaymentService } from '@/lib/billing/payment-service';
import { TIER_BADGE_COLOR, TIER_LABEL_KEY } from './plan-tier';

/**
 * Mandatory, non-dismissible — same mechanism as `ManagerSignupScreen.tsx`'s `PlanPickerModal`
 * ("a Manager account doesn't exist until one is picked"): no backdrop-dismiss `Pressable`, no close
 * icon, no cancel path, ever. Mounted at the root (`NavigatorStack` in `src/app/_layout.tsx`), not
 * inside a single screen, so it blocks the whole app regardless of which tab is active.
 *
 * Rendered as a single floating card centred over a dimmed backdrop (not a full-bleed page) — the
 * previous version filled the screen edge-to-edge and ignored the safe area, so its title sat right
 * under the status bar on a notched phone. `useSafeAreaInsets` plus simply centring the card inside
 * the Modal instead of pinning content to the top fixes both at once.
 *
 * The choices offered are the Client's own gym's real `site_plan_cards` (name + price the Manager
 * set, "Gestione abbonamenti" → "Le mie carte") — not a fixed Monthly/Annual pair.
 */
export function PlanChoiceModal({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const cards = useAsync(() => getAvailablePlanCards(), [], visible);
  const [step, setStep] = useState<'choose' | 'pay'>('choose');
  const [card, setCard] = useState<PlanCard | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pop-in: scale + fade, not just the subtler `FadeSlideIn` used for a page's own cards — this is a
  // whole popup appearing on top of the app, so it reads as its own distinct moment.
  const [progress] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  useEffect(() => {
    if (!visible) {
      if (!reduceMotion) progress.setValue(0);
      return;
    }
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    Animated.spring(progress, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 9 }).start();
  }, [visible, reduceMotion, progress]);
  const cardScale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  // The backdrop fades in on its own native-driver value too (opacity can't share a driver with a
  // non-transform/opacity-only interpolation safely otherwise) — without this, a near-black theme
  // makes a backdrop that's merely *present* read as if there were no dimming at all; fading it in
  // from fully transparent to clearly dark makes the transition itself the visible cue.
  const backdropOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.85] });

  function pick(c: PlanCard): void {
    setCard(c);
    setStep('pay');
    setError(null);
  }

  async function pay(): Promise<void> {
    if (!card) return;
    setBusy(true);
    setError(null);
    try {
      const result = await PaymentService.charge({ planName: card.name, priceEur: card.priceEur });
      if (!result.success) throw new Error('payment failed');
      await choosePlan(card.id);
      setStep('choose');
      setCard(null);
      onDone();
    } catch {
      setError(t('billing.choice.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent statusBarTranslucent>
      {/* Explicit `absoluteFillObject`, not just `flex: 1` on the Modal's own content view — on some
          iOS/Expo Go combinations a plain flex:1 child of a transparent Modal doesn't reliably resolve
          to the full window height, which left the backdrop covering only the area around the card
          instead of the whole screen (the bug this card's own screenshot showed: Home's header and
          tab bar still at full brightness behind it, completely undimmed). Pinning all four edges
          removes that ambiguity. */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: backdropOpacity }]} />
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: spacing.lg,
            paddingTop: insets.top + spacing.lg,
            paddingBottom: insets.bottom + spacing.lg,
          },
        ]}>
        <Animated.View style={{ width: '100%', maxWidth: 420, maxHeight: '100%', opacity: progress, transform: [{ scale: cardScale }] }}>
          <View
            style={[
              {
                borderRadius: radius.xl,
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.border,
                padding: spacing.xl,
                gap: spacing.lg,
              },
              CARD_SHADOW,
            ]}>
            <View style={{ alignItems: 'center', gap: spacing.sm }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: `${theme.primary}1f`, alignItems: 'center', justifyContent: 'center' }}>
                <CreditCardIcon color={theme.primary} size={24} />
              </View>
              <AppText style={{ fontFamily: fontFamily.display, fontSize: 24, textAlign: 'center' }}>{t('billing.choice.title')}</AppText>
              <AppText muted style={{ fontSize: 13.5, lineHeight: 19, textAlign: 'center' }}>
                {step === 'choose' ? t('billing.choice.subtitle') : t('billing.pay.subtitle')}
              </AppText>
            </View>

            {step === 'choose' ? (
              cards.loading && cards.data === undefined ? (
                <ActivityIndicator />
              ) : cards.data && cards.data.length === 0 ? (
                <Banner title={t('billing.choice.empty')} />
              ) : (
                <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                  <View style={{ gap: spacing.sm }}>
                    {(cards.data ?? []).map((c) => {
                      const tint = c.color ?? theme.primary;
                      return (
                      <Pressable
                        key={c.id}
                        onPress={() => pick(c)}
                        accessibilityRole="button"
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          alignItems: 'flex-start',
                          gap: spacing.sm,
                          padding: spacing.md,
                          borderRadius: radius.lg,
                          backgroundColor: theme.surfaceAlt,
                          borderWidth: 1.5,
                          borderColor: theme.border,
                          borderLeftWidth: 3,
                          borderLeftColor: tint,
                          transform: [{ scale: pressed ? 0.97 : 1 }],
                        })}>
                        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: `${tint}1f`, alignItems: 'center', justifyContent: 'center' }}>
                          <ClockIcon color={tint} size={18} />
                        </View>
                        <View style={{ flex: 1, gap: 1 }}>
                          {c.tier !== 'normal' ? (
                            <View
                              style={{ alignSelf: 'flex-start', paddingVertical: 2, paddingHorizontal: 7, borderRadius: radius.pill, backgroundColor: TIER_BADGE_COLOR[c.tier], marginBottom: 2 }}>
                              <AppText style={{ color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.4 }}>{t(TIER_LABEL_KEY[c.tier])}</AppText>
                            </View>
                          ) : null}
                          <AppText numberOfLines={1} style={{ fontWeight: '800', fontSize: 15.5 }}>
                            {c.name}
                          </AppText>
                          <AppText muted style={{ fontSize: 12.5 }}>
                            {t('billing.card.subtitle', { price: c.priceEur.toFixed(2), days: c.durationDays })}
                          </AppText>
                          {c.description ? (
                            <AppText muted numberOfLines={2} style={{ fontSize: 12, lineHeight: 16, marginTop: 2 }}>
                              {c.description}
                            </AppText>
                          ) : null}
                        </View>
                        <View style={{ marginTop: 10 }}>
                          <ChevronRightIcon color={theme.textMuted} size={18} />
                        </View>
                      </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              )
            ) : (
              <View style={{ gap: spacing.md }}>
                <View style={{ alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: theme.band.amber.soft }}>
                  <AppText style={{ color: theme.band.amber.onSoft, fontWeight: '700', fontSize: 12 }}>{t('billing.pay.demoBadge')}</AppText>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: theme.surfaceAlt, borderWidth: 1.5, borderColor: theme.border }}>
                  <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: `${theme.band.green.solid}1f`, alignItems: 'center', justifyContent: 'center' }}>
                    <CheckIcon color={theme.band.green.solid} size={18} />
                  </View>
                  <View style={{ flex: 1, gap: 1 }}>
                    {card && card.tier !== 'normal' ? (
                      <View
                        style={{ alignSelf: 'flex-start', paddingVertical: 2, paddingHorizontal: 7, borderRadius: radius.pill, backgroundColor: TIER_BADGE_COLOR[card.tier], marginBottom: 2 }}>
                        <AppText style={{ color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.4 }}>{t(TIER_LABEL_KEY[card.tier])}</AppText>
                      </View>
                    ) : null}
                    <AppText style={{ fontWeight: '800', fontSize: 15.5 }}>{card?.name}</AppText>
                    <AppText muted style={{ fontSize: 12.5 }}>{card ? `€${card.priceEur.toFixed(2)} · ${card.durationDays}g` : ''}</AppText>
                    {card?.description ? (
                      <AppText muted numberOfLines={2} style={{ fontSize: 12, lineHeight: 16, marginTop: 2 }}>
                        {card.description}
                      </AppText>
                    ) : null}
                  </View>
                </View>

                {error ? <Banner title={error} /> : null}

                <Button label={t('billing.pay.submit')} onPress={() => void pay()} disabled={busy} />
                {busy ? <ActivityIndicator /> : null}
                <AppText onPress={() => setStep('choose')} style={{ color: theme.primary, fontWeight: '600', fontSize: 13, textAlign: 'center' }}>
                  {t('billing.pay.changePlan')}
                </AppText>
              </View>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
