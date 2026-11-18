import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { bothNames } from '../components/CountryCard';
import { Flag } from '../components/Flag';
import { GameQuestion } from '../components/Quiz';
import { Button, Card, Eyebrow, H1, H2, Muted, ProgressBar, Screen, StateView } from '../components/ui';
import { QUESTION_TYPES, ROUND_LENGTH, buildRound } from '../core/questions';
import { mulberry32 } from '../core/rng';
import type { Difficulty, GameMode, Question } from '../core/types';
import { countries, countryIndex } from '../data';
import { useApp } from '../state/AppProvider';
import { colors, fonts, radius, space } from '../theme';

type Built = { ok: true; questions: Question[] } | { ok: false; reason: 'pool' | 'error' };

export default function RoundScreen() {
  const params = useLocalSearchParams<{ mode?: string; difficulty?: string; pool?: string }>();
  const { t, lang, discovered, mistakes, recordGameAnswer } = useApp();
  const router = useRouter();
  const mode: GameMode = params.mode === 'mixed' || QUESTION_TYPES.includes(params.mode as never) ? (params.mode as GameMode) : 'mixed';
  const difficulty: Difficulty = params.difficulty === 'hard' ? 'hard' : 'easy';
  const mine = params.pool === 'mine';

  const build = useCallback((): Built => {
    try {
      const pool = mine ? discovered : countries.map((c) => c.id);
      if (pool.length < ROUND_LENGTH) return { ok: false, reason: 'pool' };
      return { ok: true, questions: buildRound(countryIndex, { mode, difficulty, pool, mistakes, rand: mulberry32((Date.now() ^ (Math.random() * 2 ** 31)) >>> 0) }) };
    } catch {
      return { ok: false, reason: 'error' };
    }
    // a round is built once per (re)start; later changes to mistakes must not rebuild it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, difficulty, mine]);

  const [round, setRound] = useState<Built>(build);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [answers, setAnswers] = useState<boolean[]>([]);

  const restart = () => { setRound(build()); setIndex(0); setPicked(null); setAnswers([]); };
  const title = `${t(mode === 'flag' ? 'modeFlag' : mode === 'map' ? 'modeMap' : mode === 'fact' ? 'modeFact' : mode === 'photo' ? 'modePhoto' : 'modeMixed')} · ${t(difficulty)}`;

  if (!round.ok) {
    return (
      <Screen maxWidth={760}>
        <Stack.Screen options={{ title }} />
        {round.reason === 'pool' ? (
          <StateView kind="empty" title={t('poolTooSmall', { n: discovered.length })} actionLabel={t('poolUseAll')} onAction={() => router.replace({ pathname: '/round', params: { mode, difficulty, pool: 'all' } })} />
        ) : (
          <StateView kind="error" title={t('errorTitle')} actionLabel={t('retry')} onAction={restart} />
        )}
      </Screen>
    );
  }

  const { questions } = round;

  if (index >= questions.length) {
    const score = answers.filter(Boolean).length;
    const missed = questions.filter((_, i) => !answers[i]);
    return (
      <Screen maxWidth={760}>
        <Stack.Screen options={{ title }} />
        <Card testID="round-result">
          <Eyebrow>{t('roundResult')}</Eyebrow>
          <H1 testID="round-score">{t('roundScore', { n: score, total: questions.length })}</H1>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {answers.map((ok, i) => <View key={i} style={[styles.dot, { backgroundColor: ok ? colors.success : colors.danger }]} />)}
          </View>
          {missed.length === 0 ? <Muted>{t('roundPerfect')}</Muted> : null}
        </Card>
        {missed.length > 0 ? (
          <Card>
            <H2>{t('roundMissed')}</H2>
            <Muted>{t('roundMissedHint')}</Muted>
            {missed.map((q) => {
              const c = countryIndex.byId[q.answer];
              return (
                <Pressable key={q.answer} testID={`missed-${c.id}`} accessibilityRole="link" accessibilityLabel={bothNames(c, lang)} onPress={() => router.push(`/country/${c.id}`)} style={styles.missed}>
                  <Flag id={c.id} width={44} />
                  <Text style={styles.missedName}>{bothNames(c, lang)}</Text>
                  <Text style={{ color: colors.ocean, fontSize: 18 }}>›</Text>
                </Pressable>
              );
            })}
          </Card>
        ) : null}
        <Button label={t('playAgain')} onPress={restart} testID="play-again" />
        <Button label={t('changeMode')} variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const q = questions[index];
  const pick = (id: string) => {
    if (picked) return;
    const ok = id === q.answer;
    setPicked(id);
    setAnswers((a) => [...a, ok]);
    recordGameAnswer(q, ok);
  };

  return (
    <Screen maxWidth={760}>
      <Stack.Screen options={{ title }} />
      <View style={{ gap: space.sm }}>
        <Muted testID="round-progress">{t('questionOf', { n: index + 1, total: questions.length })}</Muted>
        <ProgressBar value={(index + (picked ? 1 : 0)) / questions.length} color={colors.ocean} />
      </View>
      <GameQuestion key={index} q={q} picked={picked} onPick={pick} />
      {picked ? <Button label={index === questions.length - 1 ? t('seeResult') : t('next')} onPress={() => { setPicked(null); setIndex((i) => i + 1); }} testID="round-next" /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dot: { flex: 1, height: 8, borderRadius: 4 },
  missed: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, minHeight: 52, borderRadius: radius.sm },
  missedName: { flex: 1, fontFamily: fonts.body, fontSize: 16, fontWeight: '700', color: colors.ink },
});
