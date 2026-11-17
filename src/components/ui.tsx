import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, type TextProps, View, type ViewStyle, useWindowDimensions, type StyleProp } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Lang } from '../core/types';
import { useApp } from '../state/AppProvider';
import { MAX_CONTENT_WIDTH, WIDE_BREAKPOINT, colors, fonts, radius, space } from '../theme';

export const useIsWide = () => useWindowDimensions().width >= WIDE_BREAKPOINT;

/** Scrollable page with the cream paper background and a centred, width-limited column. */
export function Screen({ children, scroll = true, maxWidth = MAX_CONTENT_WIDTH, padBottom = true }: { children: React.ReactNode; scroll?: boolean; maxWidth?: number; padBottom?: boolean }) {
  const insets = useSafeAreaInsets();
  const inner = <View style={[styles.column, { maxWidth }]}>{children}</View>;
  if (!scroll) return <View style={[styles.screen, { paddingTop: insets.top }]}>{inner}</View>;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: padBottom ? space.xxl + insets.bottom : 0, paddingHorizontal: space.lg }} keyboardShouldPersistTaps="handled">
      {inner}
    </ScrollView>
  );
}

export function H1(props: TextProps) {
  return <Text accessibilityRole="header" {...props} style={[styles.h1, props.style]} />;
}
export function H2(props: TextProps) {
  return <Text accessibilityRole="header" {...props} style={[styles.h2, props.style]} />;
}
export function Body(props: TextProps) {
  return <Text {...props} style={[styles.body, props.style]} />;
}
export function Muted(props: TextProps) {
  return <Text {...props} style={[styles.muted, props.style]} />;
}
/** Upper-cases text with the rules of the given language (Turkish i → İ, English i → I). */
export function upperChildren(children: React.ReactNode, lang: Lang): React.ReactNode {
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  return React.Children.map(children, (c) => (typeof c === 'string' || typeof c === 'number' ? String(c).toLocaleUpperCase(locale) : c));
}

export function Eyebrow({ lang, children, ...props }: TextProps & { lang?: Lang }) {
  const app = useApp();
  return <Text {...props} style={[styles.eyebrow, props.style]}>{upperChildren(children, lang ?? app.lang)}</Text>;
}

export function Card({ children, style, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  return <View style={[styles.card, style]} testID={testID}>{children}</View>;
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success';

export function Button({ label, onPress, variant = 'primary', disabled, icon, style, testID, accessibilityLabel }: {
  label: string; onPress?: () => void; variant?: ButtonVariant; disabled?: boolean; icon?: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string; accessibilityLabel?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={(state) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'success' && styles.buttonSuccess,
        variant === 'ghost' && styles.buttonGhost,
        state.pressed && { opacity: 0.85 },
        (state as { focused?: boolean }).focused && styles.focus,
        disabled && { opacity: 0.45 },
        style,
      ]}>
      {icon}
      <Text style={[styles.buttonText, (variant === 'secondary' || variant === 'ghost') && { color: colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, testID }: { label: string; selected?: boolean; onPress?: () => void; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={(state) => [styles.chip, selected && styles.chipSelected, (state as { focused?: boolean }).focused && styles.focus]}>
      <Text style={[styles.chipText, selected && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

/** Small two-or-more option switch (e.g. TR / EN). */
export function Segmented<T extends string>({ options, value, onChange, label, testID }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string; testID?: string }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.segmented} testID={testID}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={testID ? `${testID}-${o.value}` : undefined}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLabel={`${label}: ${o.label}`}
            onPress={() => onChange(o.value)}
            style={(state) => [styles.segment, active && styles.segmentActive, (state as { focused?: boolean }).focused && styles.focus]}>
            <Text style={[styles.segmentText, active && { color: colors.white }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Loading / empty / error placeholder used by country and game screens. */
export function StateView({ kind, title, message, actionLabel, onAction }: { kind: 'loading' | 'empty' | 'error'; title?: string; message?: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.state} accessibilityRole={kind === 'error' ? 'alert' : undefined} accessibilityLiveRegion="polite" testID={`state-${kind}`}>
      {kind === 'loading' ? <ActivityIndicator color={colors.ocean} size="large" /> : <Text style={styles.stateGlyph}>{kind === 'error' ? '!' : '◌'}</Text>}
      {title ? <H2 style={{ textAlign: 'center' }}>{title}</H2> : null}
      {message ? <Muted style={{ textAlign: 'center' }}>{message}</Muted> : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} variant="secondary" /> : null}
    </View>
  );
}

export function ProgressBar({ value, color = colors.discovered }: { value: number; color?: string }) {
  return (
    <View style={styles.barTrack} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}>
      <View style={[styles.barFill, { width: `${Math.max(0, Math.min(1, value)) * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  column: { width: '100%', alignSelf: 'center', gap: space.lg },
  h1: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, color: colors.ink, fontWeight: '700' },
  h2: { fontFamily: fonts.display, fontSize: 21, lineHeight: 27, color: colors.ink, fontWeight: '700' },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.ink },
  muted: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.inkSoft },
  eyebrow: { fontFamily: fonts.body, fontSize: 12, letterSpacing: 1.2, color: colors.oceanDeep, fontWeight: '700' },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: space.lg, gap: space.md },
  button: { minHeight: 48, borderRadius: radius.pill, paddingHorizontal: space.xl, paddingVertical: space.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: space.sm },
  buttonPrimary: { backgroundColor: colors.ink },
  buttonSuccess: { backgroundColor: colors.success },
  buttonSecondary: { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.ink },
  buttonGhost: { backgroundColor: 'transparent' },
  buttonText: { fontFamily: fonts.body, color: colors.white, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  focus: { outlineColor: colors.accent, outlineWidth: 3, outlineStyle: 'solid', outlineOffset: 2 } as ViewStyle,
  chip: { minHeight: 40, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, justifyContent: 'center' },
  chipSelected: { backgroundColor: colors.ocean, borderColor: colors.ocean },
  chipText: { fontFamily: fonts.body, color: colors.ink, fontSize: 14, fontWeight: '600' },
  segmented: { flexDirection: 'row', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, padding: 3, alignSelf: 'flex-start' },
  segment: { minWidth: 48, minHeight: 34, paddingHorizontal: space.md, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.ink },
  segmentText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.ink },
  state: { alignItems: 'center', justifyContent: 'center', gap: space.md, paddingVertical: space.xxl * 1.5, paddingHorizontal: space.xl },
  stateGlyph: { fontSize: 40, color: colors.inkFaint, fontFamily: fonts.display },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.paperDeep, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
});
