import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { bothNames } from '../components/CountryCard';
import { Flag } from '../components/Flag';
import { AnswerOption } from '../components/Quiz';
import { WorldMap } from '../components/WorldMap';
import { Button, H2, Muted, Screen, StateView, useIsWide } from '../components/ui';
import { MYSTERY_MAX_SCORE, type MysteryState, guessMystery, initialMystery, mysteryPoints, nextMysteryClue } from '../core/mystery';
import { dailyKey } from '../core/progress';
import { mysteryOptions } from '../core/questions';
import { countryIndex, geo, getCountry } from '../data';
import { useApp } from '../state/AppProvider';
import { colors, fonts, radius, space } from '../theme';

export default function MysteryScreen() {
  const { t, lang, today, progress, mysteryDraft, saveMysteryDraft, saveDailyResult } = useApp();
  const router = useRouter();
  const wide = useIsWide();
  const answer = getCountry(today?.mysteryId);
  const dateKey = today?.dateKey ?? '';
  const saved = progress.daily[dailyKey('mystery', dateKey)];
  const options = useMemo(() => (answer ? mysteryOptions(countryIndex, dateKey, answer.id) : []), [answer, dateKey]);
  // an unfinished game is restored, so reopening the app cannot reset revealed clues
  const [state, setState] = useState<MysteryState>(() => mysteryDraft(dateKey) ?? initialMystery());

  if (!today || !answer) {
    return <Screen><StateView kind="empty" title={t('noDaily')} actionLabel={t('backToToday')} onAction={() => router.replace('/')} /></Screen>;
  }

  const update = (next: MysteryState) => {
    if (next === state) return;
    setState(next);
    saveMysteryDraft(dateKey, next);
    if (next.status !== 'playing') {
      // first completed result is final; recordDaily ignores any later attempt for this date
      saveDailyResult({ kind: 'mystery', date: dateKey, score: next.score, max: MYSTERY_MAX_SCORE, detail: [next.step] });
    }
  };

  const finished = !!saved || state.status !== 'playing';
  const score = saved?.score ?? state.score;
  const revealed = saved ? 3 : finished ? 3 : state.step;
  const won = saved ? saved.score > 0 : state.status === 'won';

  // only revealed clues are shown; locked ones are summarised by the progress bar above
  const clues = (
    <View style={{ gap: space.xl, flex: wide ? 1 : undefined }}>
      <Clue n={1} title={t('clueFact')}>
        <Text style={styles.fact} testID="mystery-fact">{answer.fact[lang]}</Text>
      </Clue>
      {revealed >= 2 ? (
        <Clue n={2} title={t('clueMap')}>
          {/* regional close-up for small and mid-sized countries, the world for large ones */}
          <WorldMap highlight={answer.id} zoomTo={geo.countries[answer.id].z[2] < 900 ? answer.id : null} aspectRatio={1.7} />
        </Clue>
      ) : null}
      {revealed >= 3 ? (
        <Clue n={3} title={t('clueFlag')}>
          <Flag id={answer.id} width={160} />
        </Clue>
      ) : null}
    </View>
  );

  const progressBar = (
    <View style={styles.progress}>
      <View style={styles.progressTrack}>
        {[1, 2, 3].map((n) => <View key={n} style={[styles.progressStep, n <= revealed && { backgroundColor: colors.ocean }]} />)}
      </View>
      <View style={styles.progressRow}>
        <Muted>{t('clueProgress', { n: revealed })}</Muted>
        {!finished ? <Text style={styles.points} testID="mystery-points">{t('pointsNow', { n: mysteryPoints(state.step) })}</Text> : null}
      </View>
    </View>
  );

  const side = finished ? (
    <View testID="mystery-result" style={[styles.result, wide && { flex: 1 }]}>
      <Muted>{won ? t('mysteryWon') : t('mysteryLost')}</Muted>
      <H2 testID="mystery-score">{t('mysteryScoreLine', { n: score })}</H2>
      <View style={styles.answerRow}>
        <Flag id={answer.id} width={64} label={t('flagOf', { name: answer.name[lang] })} />
        <View style={{ flex: 1 }}>
          <Muted>{t('mysteryAnswerWas')}</Muted>
          <Text style={styles.answerName} testID="mystery-answer">{bothNames(answer, lang)}</Text>
        </View>
      </View>
      <Button label={t('exploreCountry')} onPress={() => router.push(`/country/${answer.id}`)} testID="explore-country" />
      <Muted style={{ textAlign: 'center' }}>{t('mysterySavedNote')}</Muted>
    </View>
  ) : (
    <View style={{ gap: space.sm, flex: wide ? 1 : undefined }}>
      <H2 style={{ marginBottom: space.xs }}>{t('mysteryWhich')}</H2>
      {options.map((id, i) => {
        const c = countryIndex.byId[id];
        const out = state.eliminated.includes(id);
        return (
          <AnswerOption
            key={id}
            index={i}
            status={out ? 'wrong' : 'idle'}
            disabled={out}
            badge={out ? t('eliminated') : undefined}
            onPress={() => update(guessMystery(state, answer.id, id))}
            testID={`mystery-option-${i}${id === answer.id ? '-answer' : ''}`}
            accessibilityLabel={bothNames(c, lang)}>
            <Text style={styles.optionName}>{c.name[lang]}</Text>
            <Text style={styles.optionOther}>{c.name[lang === 'tr' ? 'en' : 'tr']}</Text>
          </AnswerOption>
        );
      })}
      {state.step < 3 ? <Button label={t('nextClue')} variant="ghost" onPress={() => update(nextMysteryClue(state))} testID="next-clue" /> : null}
    </View>
  );

  return (
    <Screen maxWidth={wide ? 1120 : 720}>
      {progressBar}
      {finished && !wide ? side : null}
      <View style={wide ? styles.wide : { gap: space.xl }}>
        {clues}
        {!finished || wide ? side : null}
      </View>
    </Screen>
  );
}

function Clue({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }} testID={`clue-${n}`}>
      <Text style={styles.clueLabel}>{n} · {title}</Text>
      <View style={{ alignItems: 'flex-start', alignSelf: 'stretch' }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wide: { flexDirection: 'row', gap: space.xxl, alignItems: 'flex-start' },
  progress: { gap: space.sm },
  progressTrack: { flexDirection: 'row', gap: 6 },
  progressStep: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.paperDeep },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  points: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.oceanDeep, backgroundColor: colors.oceanWash, paddingHorizontal: space.md, paddingVertical: 4, borderRadius: radius.pill, overflow: 'hidden' },
  clueLabel: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  fact: { fontFamily: fonts.display, fontSize: 20, lineHeight: 29, color: colors.ink },
  result: { gap: space.md, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: space.lg },
  answerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  answerName: { fontFamily: fonts.display, fontSize: 22, fontWeight: '700', color: colors.ink },
  optionName: { fontFamily: fonts.body, fontSize: 17, fontWeight: '700', color: colors.ink },
  optionOther: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
});
