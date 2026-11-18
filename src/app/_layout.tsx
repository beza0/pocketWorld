import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { StateView } from '../components/ui';
import { notifications } from '../platform/notifications';
import { offline } from '../platform/offline';
import { AppProvider, useApp } from '../state/AppProvider';
import { colors, fonts } from '../theme';

function RootNavigator() {
  const { ready, t } = useApp();
  const router = useRouter();

  useEffect(() => {
    offline.init();
    // opening the app from the daily reminder always lands on Today
    return notifications.onOpenToday(() => router.replace('/'));
  }, [router]);

  if (!ready) return <StateView kind="loading" message={t('loading')} />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.paper },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontFamily: fonts.display, fontWeight: '700' },
        headerShadowVisible: false,
        headerBackTitle: t('back'),
        contentStyle: { backgroundColor: colors.paper },
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false, title: t('appName') }} />
      <Stack.Screen name="country/[id]" options={{ title: '' }} />
      <Stack.Screen name="quiz" options={{ title: t('quizTitle') }} />
      <Stack.Screen name="mystery" options={{ title: t('mysteryTitle') }} />
      <Stack.Screen name="previous" options={{ title: t('previousDays') }} />
      <Stack.Screen name="atlas" options={{ title: t('myAtlas') }} />
      <Stack.Screen name="round" options={{ title: t('playTitle') }} />
      <Stack.Screen name="settings" options={{ title: t('settings') }} />
      <Stack.Screen name="account" options={{ title: t('account') }} />
      <Stack.Screen name="privacy" options={{ title: t('privacy') }} />
      <Stack.Screen name="+not-found" options={{ title: t('notFound') }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AppProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </AppProvider>
  );
}
