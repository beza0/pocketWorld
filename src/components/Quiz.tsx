import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { dailyKey } from '../core/progress';
import { dailyQuiz } from '../core/questions';
import type { Country, Question } from '../core/types';
import { countryIndex } from '../data';
import { continentNames } from '../i18n/strings';
import { useApp } from '../state/AppProvider';
import { colors, fonts, radius, space } from '../theme';
import { bothNames } from './CountryCard';
import { CountryPhoto } from './CountryPhoto';
import { Flag } from './Flag';
import { WorldMap } from './WorldMap';
import { Body, Button, Card, Eyebrow, H2, Muted, upperChildren } from './ui';

export type OptionStatus = 'idle' | 'correct' | 'wrong' | 'dim';

const LETTERS = ['A', 'B', 'C', 'D'];

/** One answer option. Feedback is given with colour AND a text badge (✓ Doğru / ✗ Yanlış). */
export function AnswerOption({ index, status, disabled, onPress, children, badge, testID, accessibilityLabel, compact }: {
  index: number; status: OptionStatus; disabled?: boolean; onPress: () => void; children: React.ReactNode; badge?: string; testID?: string; accessibilityLabel?: string; compact?: boolean;
}) {
  const { lang } = useApp();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ? `${LETTERS[index]}. ${accessibilityLabel}${badge ? `. ${badge}` : ''}` : undefined}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={(state) => [
        styles.option,
        compact && styles.optionCompact,
        status === 'correct' && styles.optionCorrect,
        status === 'wrong' && styles.optionWrong,
        status === 'dim' && { opacity: 0.5 },
        state.pressed && { opacity: 0.85 },
        (state as { focused?: boolean }).focused && styles.focus,
      ]}>
      <View style={[styles.letter, status === 'correct' && { backgroundColor: colors.success }, status === 'wrong' && { backgroundColor: colors.danger }]}>
        <Text style={styles.letterText}>{status === 'correct' ? '✓' : status === 'wrong' ? '✗' : LETTERS[index]}</Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        {children}
        {badge ? <Text style={[styles.badge, { color: status === 'wrong' ? colors.danger : colors.success }]}>{upperChildren(badge, lang)}</Text> : null}
      </View>
    </Pressable>
  );
}

function statusOf(option: string, q: Question, picked: string | null): OptionStatus {
  if (!picked) return 'idle';
  if (option === q.answer) return 'correct';
  if (option === picked) return 'wrong';
  return 'dim';
}

function Feedback({ correct, text }: { correct: boolean; text: string }) {
  const { t } = useApp();
  return (
    <View style={[styles.feedback, correct ? styles.feedbackOk : styles.feedbackBad]} accessibilityLiveRegion="polite" testID="feedback">
      <Text style={[styles.feedbackTitle, { color: correct ? colors.success : colors.danger }]}>{correct ? `✓ ${t('correct')}` : `✗ ${t('wrong')}`}</Text>
      <Body>{text}</Body>
    </View>
  );
}

// ---------------------------------------------------------------- daily quiz

/**
 * "Bugünün 3 Sorusu". The country is known, so the options are flags, maps and statements.
 * The first completed result is stored under the date key and shown again on later visits.
 */
export function DailyQuiz({ country, dateKey }: { country: Country; dateKey: string }) {
  const { t, lang, progress, saveDailyResult } = useApp();
  const router = useRouter();
  const saved = progress.daily[dailyKey('quiz', dateKey)];
  const questions = useMemo(() => dailyQuiz(countryIndex, dateKey, country.id), [dateKey, country.id]);
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [results, setResults] = useState<number[]>([]);
  const name = country.name[lang];

  // a saved result is shown on later visits; during play the last explanation is shown first
  if ((saved && !started) || step >= questions.length) {
    const detail = saved?.detail ?? results;
    const score = saved?.score ?? results.reduce((a, b) => a + b, 0);
    return (
      <Card testID="quiz-result">
        <Eyebrow>{t('quizDone')}</Eyebrow>
        <H2 testID="quiz-score">{t('quizScore', { n: score, total: questions.length })}</H2>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {detail.map((d, i) => (
            <View key={i} style={[styles.pip, d ? styles.pipOk : styles.pipBad]}>
              <Text style={{ color: d ? colors.success : colors.danger, fontWeight: '700' }}>{d ? '✓' : '✗'} {i + 1}</Text>
            </View>
          ))}
        </View>
        <Muted>{t('quizSaved')}</Muted>
        <Button label={t('goMystery')} onPress={() => router.push('/mystery')} testID="go-mystery" />
      </Card>
    );
  }

  if (!started) {
    return (
      <Card testID="quiz-intro">
        <H2>{t('quizTitle')}</H2>
        <Muted>{t('quizIntro')}</Muted>
        <Button label={t('quizStart')} onPress={() => setStarted(true)} testID="quiz-start" />
      </Card>
    );
  }

  const q = questions[step];
  const answered = picked !== null;
  const correct = picked === q.answer;
  const other = picked && picked !== q.answer ? countryIndex.byId[picked].name[lang] : '';
  const continent = continentNames[lang][country.continent];
  const prompt = q.type === 'flag' ? t('quizQFlag', { name }) : q.type === 'map' ? t('quizQMap', { name }) : t('quizQFact', { name });
  const explanation =
    q.type === 'flag' ? (correct ? t('explainFlag', { name }) : t('explainFlagWrong', { other }))
    : q.type === 'map' ? (correct ? t('explainMap', { name, continent, capital: country.capital[lang] }) : t('explainMapWrong', { other, name, continent }))
    : correct ? country.fact[lang] : `${t('explainFactWrong', { other })} ${country.fact[lang]}`;

  const choose = (option: string) => {
    if (answered) return;
    setPicked(option);
    const next = [...results, option === q.answer ? 1 : 0];
    setResults(next);
    // save as soon as the last question is answered so leaving the screen cannot lose the result
    if (next.length === questions.length) saveDailyResult({ kind: 'quiz', date: dateKey, score: next.reduce((a, b) => a + b, 0), max: questions.length, detail: next });
  };

  const badgeFor = (option: string) => (!answered ? undefined : option === q.answer ? t('rightAnswer') : option === picked ? t('yourChoice') : undefined);

  return (
    <Card testID="quiz-question">
      <Eyebrow>{t('quizTitle')} · {t('questionOf', { n: step + 1, total: questions.length })}</Eyebrow>
      <H2>{prompt}</H2>
      <View style={q.type === 'fact' ? { gap: space.sm } : styles.grid}>
        {q.options.map((option, i) => {
          const status = statusOf(option, q, picked);
          const common = { index: i, status, disabled: answered, onPress: () => choose(option), badge: badgeFor(option), testID: `quiz-option-${i}${option === q.answer ? '-answer' : ''}` };
          if (q.type === 'flag') {
            return (
              <View key={option} style={styles.cell}>
                <AnswerOption {...common} compact accessibilityLabel={`${t('clueFlag')} ${i + 1}`}>
                  <Flag id={option} width="100%" />
                </AnswerOption>
              </View>
            );
          }
          if (q.type === 'map') {
            return (
              <View key={option} style={styles.cell}>
                <AnswerOption {...common} compact accessibilityLabel={`${t('modeMap')} ${i + 1}`}>
                  <WorldMap highlight={option} zoomTo={option} aspectRatio={1.3} />
                </AnswerOption>
              </View>
            );
          }
          return (
            <AnswerOption key={option} {...common} accessibilityLabel={countryIndex.byId[option].fact[lang]}>
              <Body>{countryIndex.byId[option].fact[lang]}</Body>
            </AnswerOption>
          );
        })}
      </View>
      {answered ? (
        <>
          <Feedback correct={correct} text={explanation} />
          <Button
            label={step === questions.length - 1 ? t('seeResult') : t('next')}
            onPress={() => { setPicked(null); setStep((s) => s + 1); }}
            testID="quiz-next"
          />
        </>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------- free play

/** One free-play question: a clue (flag / map / text / photo) and four country names. */
export function GameQuestion({ q, picked, onPick }: { q: Question; picked: string | null; onPick: (id: string) => void }) {
  const { t, lang } = useApp();
  const answer = countryIndex.byId[q.answer];
  const answered = picked !== null;
  const correct = picked === q.answer;
  const prompt = q.type === 'flag' ? t('qFlag') : q.type === 'map' ? t('qMap') : q.type === 'photo' ? t('qPhoto') : t('qFact');
  const names = bothNames(answer, lang);
  const explanation =
    q.type === 'photo' ? `${t('explainPhoto', { place: answer.place[lang], name: names })} ${answer.sight[lang]}`
    : q.type === 'fact' ? `${t('explainIs', { name: names })} ${q.clue === 'fact' ? t('explainCapital', { capital: answer.capital[lang] }) : answer.fact[lang]}`
    : q.type === 'map' ? `${t('explainIs', { name: names })} ${t('explainMap', { name: answer.name[lang], continent: continentNames[lang][answer.continent], capital: answer.capital[lang] })}`
    : `${t('explainIs', { name: names })} ${t('explainCapital', { capital: answer.capital[lang] })}`;

  return (
    <View style={{ gap: space.lg }} testID={`game-question-${q.type}`}>
      <H2>{prompt}</H2>
      <View style={styles.clue}>
        {q.type === 'flag' ? <Flag id={q.answer} width={220} /> : null}
        {/* hard: zoomed to the region so neighbours matter; easy: whole world for orientation */}
        {q.type === 'map' ? <WorldMap highlight={q.answer} zoomTo={q.difficulty === 'hard' ? q.answer : null} aspectRatio={1.7} style={{ maxWidth: 640 }} /> : null}
        {q.type === 'photo' ? <CountryPhoto id={q.answer} aspectRatio={3 / 2} style={{ maxWidth: 640 }} missingLabel={t('photoUnavailable')} /> : null}
        {q.type === 'fact' ? (
          <View style={styles.clueText}>
            <Body style={{ fontSize: 18, lineHeight: 27 }} testID="game-clue">{answer[q.clue ?? 'fact'][lang]}</Body>
          </View>
        ) : null}
      </View>
      <View style={{ gap: space.sm }}>
        {q.options.map((option, i) => {
          const c = countryIndex.byId[option];
          return (
            <AnswerOption
              key={option}
              index={i}
              status={statusOf(option, q, picked)}
              disabled={answered}
              onPress={() => onPick(option)}
              badge={!answered ? undefined : option === q.answer ? t('rightAnswer') : option === picked ? t('yourChoice') : undefined}
              testID={`game-option-${i}${option === q.answer ? '-answer' : ''}`}
              accessibilityLabel={bothNames(c, lang)}>
              <Text style={styles.optionName}>{c.name[lang]}</Text>
              <Text style={styles.optionOther}>{c.name[lang === 'tr' ? 'en' : 'tr']}</Text>
            </AnswerOption>
          );
        })}
      </View>
      {answered ? <Feedback correct={correct} text={explanation} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, minHeight: 56, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card },
  optionCompact: { flexDirection: 'column', alignItems: 'stretch', gap: space.sm, padding: space.sm },
  optionCorrect: { borderColor: colors.success, backgroundColor: colors.successWash },
  optionWrong: { borderColor: colors.danger, backgroundColor: colors.dangerWash },
  focus: { outlineColor: colors.accent, outlineWidth: 3, outlineStyle: 'solid', outlineOffset: 2 } as ViewStyle,
  letter: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  letterText: { color: colors.white, fontWeight: '700', fontFamily: fonts.body, fontSize: 14 },
  badge: { fontFamily: fonts.body, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 },
  optionName: { fontFamily: fonts.body, fontSize: 17, fontWeight: '700', color: colors.ink },
  optionOther: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -space.xs },
  cell: { width: '50%', padding: space.xs },
  feedback: { borderRadius: radius.md, padding: space.lg, gap: space.xs, borderWidth: 1 },
  feedbackOk: { backgroundColor: colors.successWash, borderColor: colors.success },
  feedbackBad: { backgroundColor: colors.dangerWash, borderColor: colors.danger },
  feedbackTitle: { fontFamily: fonts.body, fontWeight: '700', fontSize: 16 },
  pip: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill, borderWidth: 1 },
  pipOk: { borderColor: colors.success, backgroundColor: colors.successWash },
  pipBad: { borderColor: colors.danger, backgroundColor: colors.dangerWash },
  clue: { alignItems: 'center' },
  clueText: { backgroundColor: colors.paperDeep, borderRadius: radius.md, padding: space.lg, borderLeftWidth: 4, borderLeftColor: colors.ocean, alignSelf: 'stretch' },
});
