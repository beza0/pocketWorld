import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Flag } from '../../components/Flag';
import { Button, Card, Chip, H1, H2, Muted, ProgressBar, StateView } from '../../components/ui';
import { searchCountries } from '../../core/search';
import { CONTINENTS, type ContinentId, type Country } from '../../core/types';
import { countries } from '../../data';
import { continentNames } from '../../i18n/strings';
import { useApp } from '../../state/AppProvider';
import { MAX_CONTENT_WIDTH, colors, fonts, radius, space } from '../../theme';

export default function CountriesScreen() {
  const { t, lang, discovered, isDiscovered } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [continent, setContinent] = useState<ContinentId | null>(null);

  const sorted = useMemo(() => [...countries].sort((a, b) => a.name[lang].localeCompare(b.name[lang], lang)), [lang]);
  const results = useMemo(() => searchCountries(sorted, { query, continent }), [sorted, query, continent]);

  const header = (
    <View style={{ gap: space.lg, paddingBottom: space.md }}>
      <H1>{t('tabCountries')}</H1>
      <Card testID="atlas-summary">
        <H2>{t('myAtlas')}</H2>
        <Text style={styles.count} testID="discovered-count">{t('discoveredCount', { n: discovered.length, total: countries.length })}</Text>
        <ProgressBar value={discovered.length / countries.length} />
        <Button label={t('openAtlas')} variant="secondary" onPress={() => router.push('/atlas')} testID="open-atlas" />
      </Card>
      <TextInput
        testID="country-search"
        value={query}
        onChangeText={setQuery}
        placeholder={t('searchPlaceholder')}
        placeholderTextColor={colors.inkFaint}
        accessibilityLabel={t('searchPlaceholder')}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="while-editing"
        style={styles.search}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        <Chip label={t('allContinents')} selected={continent === null} onPress={() => setContinent(null)} testID="continent-all" />
        {CONTINENTS.map((c) => (
          <Chip key={c} label={continentNames[lang][c]} selected={continent === c} onPress={() => setContinent(continent === c ? null : c)} testID={`continent-${c}`} />
        ))}
      </ScrollView>
      <Muted testID="result-count">{t('countryCount', { n: results.length })}</Muted>
    </View>
  );

  return (
    <FlatList<Country>
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.lg, paddingBottom: space.xxl, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' }}
      data={results}
      keyExtractor={(c) => c.id}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={header}
      initialNumToRender={20}
      ListEmptyComponent={
        <StateView
          kind="empty"
          title={t('noResults', { q: query })}
          message={t('noResultsHint')}
          actionLabel={t('clearSearch')}
          onAction={() => { setQuery(''); setContinent(null); }}
        />
      }
      renderItem={({ item }) => (
        <Pressable
          testID={`country-row-${item.id}`}
          accessibilityRole="link"
          accessibilityLabel={`${item.name.tr} · ${item.name.en}`}
          onPress={() => router.push(`/country/${item.id}`)}
          style={(state) => [styles.row, state.pressed && { backgroundColor: colors.paperDeep }, (state as { focused?: boolean }).focused && styles.focus]}>
          <Flag id={item.id} width={52} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowName}>{item.name[lang]} <Text style={styles.rowOther}>· {item.name[lang === 'tr' ? 'en' : 'tr']}</Text></Text>
            <Muted>{item.capital[lang]} · {continentNames[lang][item.continent]}</Muted>
          </View>
          {isDiscovered(item.id) ? <Text style={styles.tick} accessibilityLabel={t('discoveredDone')}>✓</Text> : null}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  count: { fontFamily: fonts.body, fontSize: 16, fontWeight: '700', color: colors.ink },
  search: { minHeight: 50, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card, paddingHorizontal: space.xl, fontSize: 16, color: colors.ink, fontFamily: fonts.body },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, borderRadius: radius.sm },
  rowName: { fontFamily: fonts.body, fontSize: 17, fontWeight: '700', color: colors.ink },
  rowOther: { fontWeight: '400', color: colors.inkSoft },
  tick: { color: colors.discovered, fontSize: 20, fontWeight: '700' },
  focus: { outlineColor: colors.accent, outlineWidth: 3, outlineStyle: 'solid' } as object,
});
