import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Flag } from '../components/Flag';
import { WorldMap } from '../components/WorldMap';
import { Body, Button, Card, H1, H2, Muted, ProgressBar, Screen, useIsWide } from '../components/ui';
import { CONTINENTS } from '../core/types';
import { countries, countryIndex } from '../data';
import { continentNames } from '../i18n/strings';
import { useApp } from '../state/AppProvider';
import { colors, fonts, radius, space } from '../theme';

/** Keşif Haritam: countries the user marked with "Keşfettim", in total and per continent. */
export default function AtlasScreen() {
  const { t, lang, discovered, email, syncConfigured } = useApp();
  const router = useRouter();
  const wide = useIsWide();
  const perContinent = useMemo(() => CONTINENTS.map((id) => {
    const all = countries.filter((c) => c.continent === id);
    return { id, total: all.length, found: all.filter((c) => discovered.includes(c.id)).length };
  }), [discovered]);
  const list = useMemo(() => discovered.map((id) => countryIndex.byId[id]).filter(Boolean).sort((a, b) => a.name[lang].localeCompare(b.name[lang], lang)), [discovered, lang]);

  return (
    <Screen>
      <View style={{ gap: space.xs }}>
        <H1 testID="atlas-count">{t('discoveredCount', { n: discovered.length, total: countries.length })}</H1>
        <ProgressBar value={discovered.length / countries.length} />
      </View>
      <View style={wide ? styles.wide : { gap: space.lg }}>
        <View style={{ flex: wide ? 1.6 : undefined, gap: space.md }}>
          <WorldMap discovered={discovered} accessibilityLabel={t('myAtlas')} aspectRatio={wide ? 2 : 1.6} />
          {discovered.length === 0 ? <Card testID="atlas-empty"><Body>{t('atlasEmpty')}</Body><Button label={t('goCountries')} variant="secondary" onPress={() => router.push('/countries')} /></Card> : null}
        </View>
        <Card style={wide ? { flex: 1 } : undefined}>
          <H2>{t('byContinent')}</H2>
          {perContinent.map((c) => (
            <View key={c.id} style={{ gap: 4 }} testID={`continent-progress-${c.id}`}>
              <View style={styles.contRow}>
                <Text style={styles.contName}>{continentNames[lang][c.id]}</Text>
                <Text style={styles.contCount}>{c.found} / {c.total}</Text>
              </View>
              <ProgressBar value={c.found / c.total} />
            </View>
          ))}
        </Card>
      </View>

      {list.length > 0 ? (
        <Card>
          <H2>{t('discoveredList')}</H2>
          <View style={styles.chips}>
            {list.map((c) => (
              <Pressable key={c.id} accessibilityRole="link" accessibilityLabel={`${c.name.tr} · ${c.name.en}`} onPress={() => router.push(`/country/${c.id}`)} style={styles.chip} testID={`atlas-country-${c.id}`}>
                <Flag id={c.id} width={28} />
                <Text style={styles.chipText}>{c.name[lang]}</Text>
              </Pressable>
            ))}
          </View>
        </Card>
      ) : null}

      <Card testID="backup-card">
        <H2>{t('backup')}</H2>
        <Muted>{email ? t('accountSignedIn', { email }) : syncConfigured ? t('backupHint') : t('syncNotConfigured')}</Muted>
        <Button label={email ? t('account') : t('backup')} variant="secondary" onPress={() => router.push('/account')} testID="open-backup" />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wide: { flexDirection: 'row', gap: space.xl, alignItems: 'flex-start' },
  contRow: { flexDirection: 'row', justifyContent: 'space-between' },
  contName: { fontFamily: fonts.body, fontSize: 15, fontWeight: '700', color: colors.ink },
  contCount: { fontFamily: fonts.body, fontSize: 15, color: colors.inkSoft },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, paddingHorizontal: space.md, minHeight: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  chipText: { fontFamily: fonts.body, fontSize: 14, fontWeight: '600', color: colors.ink },
});
