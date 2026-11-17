import { Tabs } from 'expo-router/js-tabs';
import React from 'react';
import { GlobeIcon, PlayIcon, SunIcon } from '../../components/icons';
import { useApp } from '../../state/AppProvider';
import { colors, fonts } from '../../theme';

export default function TabsLayout() {
  const { t } = useApp();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.oceanDeep,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line },
        tabBarLabelStyle: { fontFamily: fonts.body, fontSize: 12, fontWeight: '700' },
        sceneStyle: { backgroundColor: colors.paper },
      }}>
      <Tabs.Screen name="index" options={{ title: t('tabToday'), tabBarIcon: ({ color }) => <SunIcon color={color} />, tabBarButtonTestID: 'tab-today' }} />
      <Tabs.Screen name="countries" options={{ title: t('tabCountries'), tabBarIcon: ({ color }) => <GlobeIcon color={color} />, tabBarButtonTestID: 'tab-countries' }} />
      <Tabs.Screen name="play" options={{ title: t('tabPlay'), tabBarIcon: ({ color }) => <PlayIcon color={color} />, tabBarButtonTestID: 'tab-play' }} />
    </Tabs>
  );
}
