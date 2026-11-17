import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { bothNames } from '../components/CountryCard';
import { Flag } from '../components/Flag';
import { AnswerOption } from '../components/Quiz';
import { WorldMap } from '../components/WorldMap';
import { Body, Button, Card, Eyebrow, H1, H2, Muted, Screen, StateView, useIsWide } from '../components/ui';
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

  const clues = (
    <View style={{ gap: space.md, flex: wide ? 1 : undefined }}>
      <Clue n={1} title={t('clueFact')} open label={t('clue', { n: 1 })}>
        <Body style={{ fontSize: 17, lineHeight: 26 }} testID="mystery-fact">{answer.fact[lang]}</Body>
      </Clue>
      <Clue n={2} title={t('clueMap')} open={revealed >= 2} label={t('clue', { n: 2 })} locked={t('clueLocked')}>
        <WorldMap highlight={answer.id} aspectRatio={1.9} />
        {/* regional close-up only when it adds detail (small and mid-sized countries) */}
        {geo.countries[answer.id].z[2] < 900 ? <WorldMap highlight={answer.id} zoomTo={answer.id} aspectRatio={1.9} /> : null}
      </Clue>
      <Clue n={3} title={t('clueFlag')} open={revealed >= 3} label={t('clue', { n: 3 })} locked={t('clueLocked')}>
        <Flag id={answer.id} width={180} />
      </Clue>
    </View>
  );

  const side = finished ? (
    <Card testID="mystery-result" style={wide ? { flex: 1 } : undefined}>
      <Eyebrow>{won ? t('mysteryWon') : t('mysteryLost')}</Eyebrow>
      <H2 testID="mystery-score">{t('mysteryScoreLine', { n: score })}</H2>
      <View style={styles.answerRow}>
        <Flag id={answer.id} width={72} label={t('flagOf', { name: answer.name[lang] })} />
        <View style={{ flex: 1 }}>
          <Muted>{t('mysteryAnswerWas')}</Muted>
          <Text style={styles.answerName} testID="mystery-answer">{bothNames(answer, lang)}</Text>
        </View>
      </View>
      <Muted>{t('mysterySavedNote')}</Muted>
      <Button label={t('exploreCountry')} onPress={() => router.push(`/country/${answer.id}`)} testID="explore-country" />
      <Button label={t('backToToday')} variant="ghost" onPress={() => router.replace('/')} />
    </Card>
  ) : (
    <View style={{ gap: space.md, flex: wide ? 1 : undefined }}>
      <H2>{t('mysteryWhich')}</H2>
      <Muted testID="mystery-points">{t('pointsNow', { n: mysteryPoints(state.step) })}</Muted>
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
      {state.step < 3 ? <Button label={t('nextClue')} variant="secondary" onPress={() => update(nextMysteryClue(state))} testID="next-clue" /> : null}
    </View>
  );

  return (
    <Screen>
      <H1>{t('mysteryTitle')}</H1>
      <View style={wide ? styles.wide : { gap: space.lg }}>
        {clues}
        {side}
      </View>
    </Screen>
  );
}

function Clue({ n, title, open, label, locked, children }: { n: number; title: string; open: boolean; label: string; locked?: string; children: React.ReactNode }) {
  return (
    <Card style={!open && styles.locked} >
      <View style={styles.clueHead}>
        <View style={[styles.clueNo, !open && { backgroundColor: colors.inkFaint }]}><Text style={styles.clueNoText}>{n}</Text></View>
        <View>
          <Eyebrow>{label}</Eyebrow>
          <Text style={styles.clueTitle}>{title}</Text>
        </View>
      </View>
      {open ? <View style={{ gap: space.sm, alignItems: 'flex-start' }} testID={`clue-${n}`}>{children}</View> : <Muted>{locked}</Muted>}
    </Card>
  );
}

const styles = StyleSheet.create({
  wide: { flexDirection: 'row', gap: space.xl, alignItems: 'flex-start' },
  locked: { backgroundColor: colors.paperDeep, borderStyle: 'dashed' },
  clueHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  clueNo: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.ocean, alignItems: 'center', justifyContent: 'center' },
  clueNoText: { color: colors.white, fontWeight: '700', fontFamily: fonts.body },
  clueTitle: { fontFamily: fonts.display, fontSize: 17, fontWeight: '700', color: colors.ink },
  answerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.paperDeep, borderRadius: radius.md, padding: space.md },
  answerName: { fontFamily: fonts.display, fontSize: 22, fontWeight: '700', color: colors.ink },
  optionName: { fontFamily: fonts.body, fontSize: 17, fontWeight: '700', color: colors.ink },
  optionOther: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
});
