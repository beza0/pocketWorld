import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Body, Button, Card, Chip, H1, H2, Muted, Screen } from '../../components/ui';
import { ROUND_LENGTH } from '../../core/questions';
import type { Difficulty, GameMode } from '../../core/types';
import type { StringKey } from '../../i18n/strings';
import { useApp } from '../../state/AppProvider';
import { colors, fonts, radius, space } from '../../theme';

const MODES: { id: GameMode; title: StringKey; desc: StringKey; glyph: string }[] = [
  { id: 'flag', title: 'modeFlag', desc: 'modeFlagDesc', glyph: '⚑' },
  { id: 'map', title: 'modeMap', desc: 'modeMapDesc', glyph: '◎' },
  { id: 'fact', title: 'modeFact', desc: 'modeFactDesc', glyph: '❝' },
  { id: 'photo', title: 'modePhoto', desc: 'modePhotoDesc', glyph: '▣' },
  { id: 'mixed', title: 'modeMixed', desc: 'modeMixedDesc', glyph: '✦' },
];

export default function PlayScreen() {
  const { t, discovered } = useApp();
  const router = useRouter();
  const [mode, setMode] = useState<GameMode>('mixed');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [pool, setPool] = useState<'all' | 'mine'>('all');
  const tooSmall = pool === 'mine' && discovered.length < ROUND_LENGTH;

  return (
    <Screen maxWidth={760}>
      <H1>{t('playTitle')}</H1>
      <Muted>{t('playIntro')}</Muted>

      <View style={styles.modes} accessibilityRole="radiogroup">
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
              style={(state) => [styles.mode, active && styles.modeActive, (state as { focused?: boolean }).focused && styles.focus]}>
              <Text style={[styles.glyph, active && { color: colors.white }]}>{m.glyph}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modeTitle, active && { color: colors.white }]}>{t(m.title)}</Text>
                <Text style={[styles.modeDesc, active && { color: '#D7E3F4' }]}>{t(m.desc)}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Card>
        <H2>{t('difficulty')}</H2>
        <View style={styles.chips}>
          <Chip label={t('easy')} selected={difficulty === 'easy'} onPress={() => setDifficulty('easy')} testID="difficulty-easy" />
          <Chip label={t('hard')} selected={difficulty === 'hard'} onPress={() => setDifficulty('hard')} testID="difficulty-hard" />
        </View>
        <Muted>{difficulty === 'easy' ? t('easyDesc') : t('hardDesc')}</Muted>
      </Card>

      <Card>
        <H2>{t('pool')}</H2>
        <View style={styles.chips}>
          <Chip label={t('poolAll')} selected={pool === 'all'} onPress={() => setPool('all')} testID="pool-all" />
          <Chip label={`${t('poolMine')} (${discovered.length})`} selected={pool === 'mine'} onPress={() => setPool('mine')} testID="pool-mine" />
        </View>
        {tooSmall ? (
          <View style={styles.notice} testID="pool-too-small" accessibilityLiveRegion="polite">
            <Body>{t('poolTooSmall', { n: discovered.length })}</Body>
            <Button label={t('poolUseAll')} variant="secondary" onPress={() => setPool('all')} testID="pool-use-all" />
          </View>
        ) : null}
      </Card>

      <Button
        label={t('startRound')}
        disabled={tooSmall}
        onPress={() => router.push({ pathname: '/round', params: { mode, difficulty, pool } })}
        testID="start-round"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  modes: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  mode: { flexGrow: 1, flexBasis: 220, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card, minHeight: 76 },
  modeActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  glyph: { fontSize: 26, color: colors.ocean, width: 32, textAlign: 'center' },
  modeTitle: { fontFamily: fonts.display, fontSize: 18, fontWeight: '700', color: colors.ink },
  modeDesc: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  chips: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  notice: { backgroundColor: colors.paperDeep, borderRadius: radius.md, padding: space.lg, gap: space.md },
  focus: { outlineColor: colors.accent, outlineWidth: 3, outlineStyle: 'solid', outlineOffset: 2 } as object,
});
