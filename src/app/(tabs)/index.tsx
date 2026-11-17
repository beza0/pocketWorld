import { Link, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CountryCard } from '../../components/CountryCard';
import { GearIcon } from '../../components/icons';
import { DailyQuiz } from '../../components/Quiz';
import { Button, Card, Eyebrow, H1, H2, Muted, Screen, StateView } from '../../components/ui';
import { dailyKey } from '../../core/progress';
import { getCountry } from '../../data';
import { formatDate } from '../../i18n/format';
import { useApp } from '../../state/AppProvider';
import { colors, fonts, radius, space } from '../../theme';

export default function TodayScreen() {
  const { t, lang, today, progress, mysteryDraft } = useApp();
  const router = useRouter();
  const country = getCountry(today?.countryId);

  if (!today || !country) {
    return (
      <Screen>
        <StateView kind="empty" title={t('noDaily')} actionLabel={t('goCountries')} onAction={() => router.push('/countries')} />
      </Screen>
    );
  }

  const mystery = progress.daily[dailyKey('mystery', today.dateKey)];
  const inProgress = !mystery && !!mysteryDraft(today.dateKey);

  return (
    <Screen>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Eyebrow>{t('appName')} · {formatDate(today.dateKey, lang)}</Eyebrow>
          <H1 testID="today-title">{t('todayQuestion')}</H1>
        </View>
        <Link href="/settings" asChild>
          <Pressable accessibilityRole="button" accessibilityLabel={t('settings')} testID="open-settings" style={styles.iconButton}>
            <GearIcon color={colors.ink} />
          </Pressable>
        </Link>
      </View>

      {/* key: a new day must start with a fresh card and quiz state */}
      <CountryCard key={today.dateKey} country={country} eyebrow={`${t('countryOfDay')} · ${t('dayNumber', { n: today.dayNumber })}`} />

      <DailyQuiz key={`quiz-${today.dateKey}`} country={country} dateKey={today.dateKey} />

      {/* The preview never shows the name, flag or any metadata of the mystery country. */}
      <Card style={styles.mystery} testID="mystery-card">
        <View style={styles.mysteryMark}><Text style={styles.mysteryMarkText}>?</Text></View>
        <View style={{ flex: 1, gap: space.xs, minWidth: 200 }}>
          <H2 style={{ color: colors.white }}>{t('mysteryTitle')}</H2>
          <Muted style={{ color: '#D7E3F4' }}>{mystery ? t('mysteryPlayed', { n: mystery.score }) : t('mysteryTeaser')}</Muted>
        </View>
        <Button
          label={mystery ? t('mysteryView') : inProgress ? t('mysteryContinue') : t('mysteryPlay')}
          variant="secondary"
          onPress={() => router.push('/mystery')}
          testID="open-mystery"
        />
      </Card>

      <Button label={t('previousDays')} variant="ghost" onPress={() => router.push('/previous')} testID="open-previous" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  iconButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  mystery: { backgroundColor: colors.ink, borderColor: colors.ink, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  mysteryMark: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.ocean, alignItems: 'center', justifyContent: 'center' },
  mysteryMarkText: { color: colors.white, fontFamily: fonts.display, fontSize: 30, fontWeight: '700' },
});
