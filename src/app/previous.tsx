import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Flag } from '../components/Flag';
import { Muted, StateView } from '../components/ui';
import { type Daily, previousDays } from '../core/calendar';
import { calendar, countryIndex } from '../data';
import { formatDate } from '../i18n/format';
import { useApp } from '../state/AppProvider';
import { colors, fonts, radius, space } from '../theme';

/** Country of the Day cards that were already published, newest first. Mystery answers are not listed. */
export default function PreviousDaysScreen() {
  const { t, lang, today, isDiscovered } = useApp();
  const router = useRouter();
  const days = useMemo(() => (today ? previousDays(calendar, today.dateKey) : []), [today]);

  return (
    <FlatList<Daily>
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ padding: space.lg, width: '100%', maxWidth: 760, alignSelf: 'center' }}
      data={days}
      keyExtractor={(d) => d.dateKey}
      ListEmptyComponent={<StateView kind="empty" title={t('previousDaysEmpty')} />}
      renderItem={({ item }) => {
        const c = countryIndex.byId[item.countryId];
        return (
          <Pressable
            testID={`previous-${item.dateKey}`}
            accessibilityRole="link"
            accessibilityLabel={`${formatDate(item.dateKey, lang)}: ${c.name.tr} · ${c.name.en}`}
            onPress={() => router.push(`/country/${c.id}`)}
            style={(state) => [styles.row, state.pressed && { backgroundColor: colors.paperDeep }]}>
            <Flag id={c.id} width={52} />
            <View style={{ flex: 1 }}>
              <Muted>{formatDate(item.dateKey, lang)} · {t('dayNumber', { n: item.dayNumber })}</Muted>
              <Text style={styles.name}>{c.name[lang]} <Text style={styles.other}>· {c.name[lang === 'tr' ? 'en' : 'tr']}</Text></Text>
            </View>
            {isDiscovered(c.id) ? <Text style={styles.tick} accessibilityLabel={t('discoveredDone')}>✓</Text> : null}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, borderRadius: radius.sm },
  name: { fontFamily: fonts.body, fontSize: 17, fontWeight: '700', color: colors.ink },
  other: { fontWeight: '400', color: colors.inkSoft },
  tick: { color: colors.discovered, fontSize: 20, fontWeight: '700' },
});
