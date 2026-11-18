import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Body, Button, H1, Muted, Screen, SectionLabel, Segmented } from '../../components/ui';
import { ROUND_LENGTH } from '../../core/questions';
import type { Difficulty, GameMode } from '../../core/types';
import type { StringKey } from '../../i18n/strings';
import { useApp } from '../../state/AppProvider';
import { colors, fonts, radius, space } from '../../theme';

const MODES: { id: GameMode; title: StringKey; desc: StringKey; glyph: string }[] = [
  { id: 'mixed', title: 'modeMixed', desc: 'modeMixedDesc', glyph: '✦' },
  { id: 'flag', title: 'modeFlag', desc: 'modeFlagDesc', glyph: '⚑' },
  { id: 'map', title: 'modeMap', desc: 'modeMapDesc', glyph: '◎' },
  { id: 'fact', title: 'modeFact', desc: 'modeFactDesc', glyph: '❝' },
  { id: 'photo', title: 'modePhoto', desc: 'modePhotoDesc', glyph: '▣' },
];

export default function PlayScreen() {
  const { t, discovered } = useApp();
  const router = useRouter();
  const [mode, setMode] = useState<GameMode>('mixed');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [pool, setPool] = useState<'all' | 'mine'>('all');
  const tooSmall = pool === 'mine' && discovered.length < ROUND_LENGTH;
  const selected = MODES.find((m) => m.id === mode)!;

  return (
    <Screen maxWidth={640}>
      <View style={{ gap: space.xs }}>
        <H1>{t('playTitle')}</H1>
        <Muted>{t('playIntro')}</Muted>
      </View>

      <SectionLabel>{t('modeLabel')}</SectionLabel>
      <View style={styles.grid} accessibilityRole="radiogroup">
        {MODES.map((m) => {
          const active = mode === m.id;
          return (
            <Pressable
              key={m.id}
              testID={`mode-${m.id}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={`${t(m.title)}. ${t(m.desc)}`}
              onPress={() => setMode(m.id)}
              style={(state) => [styles.tile, m.id === 'mixed' && styles.tileWide, active && styles.tileActive, (state as { focused?: boolean }).focused && styles.focus]}>
              <Text style={[styles.glyph, active && { color: colors.white }]}>{m.glyph}</Text>
              <Text style={[styles.tileTitle, active && { color: colors.white }]}>{t(m.title)}</Text>
            </Pressable>
          );
        })}
      </View>
      <Muted style={{ marginTop: -space.sm }}>{t(selected.desc)}</Muted>

      <SectionLabel>{t('difficulty')}</SectionLabel>
      <Segmented
        stretch
        testID="difficulty"
        label={t('difficulty')}
        value={difficulty}
        onChange={setDifficulty}
        options={[{ value: 'easy', label: t('easy') }, { value: 'hard', label: t('hard') }]}
      />
      <Muted style={{ marginTop: -space.sm }}>{difficulty === 'easy' ? t('easyDesc') : t('hardDesc')}</Muted>

      <SectionLabel>{t('pool')}</SectionLabel>
      <Segmented
        stretch
        testID="pool"
        label={t('pool')}
        value={pool}
        onChange={setPool}
        options={[{ value: 'all', label: t('poolAll') }, { value: 'mine', label: `${t('poolMine')} (${discovered.length})` }]}
      />
      {tooSmall ? (
        <View style={styles.notice} testID="pool-too-small" accessibilityLiveRegion="polite">
          <Body>{t('poolTooSmall', { n: discovered.length })}</Body>
          <Button label={t('poolUseAll')} variant="secondary" onPress={() => setPool('all')} testID="pool-use-all" />
        </View>
      ) : null}

      <Button
        label={t('startRound')}
        disabled={tooSmall}
        onPress={() => router.push({ pathname: '/round', params: { mode, difficulty, pool } })}
        testID="start-round"
        style={{ marginTop: space.sm }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flexGrow: 1, flexBasis: '45%', flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, minHeight: 56 },
  tileWide: { flexBasis: '100%' },
  tileActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  glyph: { fontSize: 20, color: colors.ocean, width: 24, textAlign: 'center' },
  tileTitle: { fontFamily: fonts.body, fontSize: 16, fontWeight: '700', color: colors.ink },
  notice: { backgroundColor: colors.paperDeep, borderRadius: radius.md, padding: space.lg, gap: space.md },
  focus: { outlineColor: colors.accent, outlineWidth: 3, outlineStyle: 'solid', outlineOffset: 2 } as ViewStyle,
});
