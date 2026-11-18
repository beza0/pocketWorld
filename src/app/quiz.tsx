import { useRouter } from 'expo-router';
import React from 'react';
import { DailyQuiz } from '../components/Quiz';
import { Screen, StateView } from '../components/ui';
import { getCountry } from '../data';
import { useApp } from '../state/AppProvider';

/** "Bugünün 3 Sorusu" on its own screen, opened from the Today list. */
export default function QuizScreen() {
  const { t, today } = useApp();
  const router = useRouter();
  const country = getCountry(today?.countryId);
  if (!today || !country) {
    return <Screen><StateView kind="empty" title={t('noDaily')} actionLabel={t('backToToday')} onAction={() => router.replace('/')} /></Screen>;
  }
  return (
    <Screen maxWidth={720}>
      <DailyQuiz key={today.dateKey} country={country} dateKey={today.dateKey} />
    </Screen>
  );
}
