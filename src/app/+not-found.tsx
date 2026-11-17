import { useRouter } from 'expo-router';
import React from 'react';
import { Screen, StateView } from '../components/ui';
import { useApp } from '../state/AppProvider';

export default function NotFound() {
  const { t } = useApp();
  const router = useRouter();
  return (
    <Screen>
      <StateView kind="error" title={t('notFound')} actionLabel={t('goHome')} onAction={() => router.replace('/')} />
    </Screen>
  );
}
