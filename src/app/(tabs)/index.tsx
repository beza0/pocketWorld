import { Link, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CountryCard } from '../../components/CountryCard';
import { GearIcon } from '../../components/icons';
import { ListGroup, ListRow, Screen, SectionLabel, StateView } from '../../components/ui';
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

  const quiz = progress.daily[dailyKey('quiz', today.dateKey)];
  const mystery = progress.daily[dailyKey('mystery', today.dateKey)];
  const mysteryStarted = !mystery && !!mysteryDraft(today.dateKey);

  // The mystery row never shows the country's name, flag or any hint about it.
  const tasks = (
    <View style={{ gap: space.md }}>
      <SectionLabel>{t('forToday')}</SectionLabel>
      <ListGroup testID="today-tasks">
        <ListRow
          testID="open-quiz"
          title={t('quizTitle')}
          subtitle={quiz ? t('quizRowDone', { n: quiz.score }) : t('quizRowSub')}
          leading={<Badge glyph="3" done={!!quiz} color={colors.ocean} />}
          onPress={() => router.push('/quiz')}
        />
        <ListRow
          testID="open-mystery"
          title={t('mysteryTitle')}
          subtitle={mystery ? t('mysteryRowDone', { n: mystery.score }) : mysteryStarted ? t('mysteryRowGoing') : t('mysteryRowSub')}
          leading={<Badge glyph="?" done={!!mystery} color={colors.ink} />}
          onPress={() => router.push('/mystery')}
        />
        <ListRow
          testID="open-previous"
          title={t('previousDays')}
          subtitle={t('previousDaysSub')}
          leading={<Badge glyph="↺" color={colors.inkSoft} />}
          onPress={() => router.push('/previous')}
        />
      </ListGroup>
    </View>
  );

  return (
    <Screen>
      <View style={styles.top}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.date}>{formatDate(today.dateKey, lang)}</Text>
          <Text accessibilityRole="header" style={styles.title} testID="today-title">{t('todayQuestion')}</Text>
        </View>
        <Link href="/settings" asChild>
          <Pressable accessibilityRole="button" accessibilityLabel={t('settings')} testID="open-settings" style={styles.iconButton}>
            <GearIcon color={colors.ink} size={22} />
          </Pressable>
        </Link>
      </View>

      {/* key: a new day must start with a fresh card */}
      <CountryCard key={today.dateKey} country={country} eyebrow={`${t('countryOfDay')} · ${t('dayNumber', { n: today.dayNumber })}`} aside={tasks} />
    </Screen>
  );
}

function Badge({ glyph, done, color }: { glyph: string; done?: boolean; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: done ? colors.success : color }]}>
      <Text style={styles.badgeText}>{done ? '✓' : glyph}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  date: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, fontWeight: '600' },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.ink, fontWeight: '700' },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  badge: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.white, fontFamily: fonts.display, fontSize: 18, fontWeight: '700' },
});
