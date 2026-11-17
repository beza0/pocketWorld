import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Country, Lang } from '../core/types';
import { attributions } from '../data';
import { type StringKey, continentNames, translate } from '../i18n/strings';
import { useApp } from '../state/AppProvider';
import { colors, fonts, radius, space } from '../theme';
import { CountryPhoto } from './CountryPhoto';
import { Flag } from './Flag';
import { WorldMap } from './WorldMap';
import { Body, Button, Card, Eyebrow, Muted, Segmented, useIsWide } from './ui';

const VISIBLE_LANGUAGES = 3;

/** Both names, always: the card language first, the other one after the dot. */
export const bothNames = (c: Country, lang: Lang) => (lang === 'tr' ? `${c.name.tr} · ${c.name.en}` : `${c.name.en} · ${c.name.tr}`);

export function CountryCard({ country, eyebrow }: { country: Country; eyebrow?: string }) {
  const { lang, isDiscovered, setCountryDiscovered, discovered } = useApp();
  const wide = useIsWide();
  // reading language of this card only; does not change the interface language
  const [cardLang, setCardLang] = useState<Lang>(lang);
  const [more, setMore] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const t = (key: StringKey, params?: Record<string, string | number>) => translate(cardLang, key, params);
  const found = isDiscovered(country.id);
  const credit = attributions[country.id];
  const langs = country.languages[cardLang];

  const header = (
    <View style={styles.header}>
      <Flag id={country.id} width={72} label={t('flagOf', { name: country.name[cardLang] })} />
      <View style={{ flex: 1, gap: 2 }}>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <Text accessibilityRole="header" style={styles.name} testID="country-name">{country.name[cardLang]}</Text>
        <Text style={styles.nameOther} testID="country-name-other">{country.name[cardLang === 'tr' ? 'en' : 'tr']}</Text>
      </View>
      <Segmented
        testID="card-lang"
        label={translate(lang, 'cardLanguage')}
        value={cardLang}
        onChange={setCardLang}
        options={[{ value: 'tr', label: 'TR' }, { value: 'en', label: 'EN' }]}
      />
    </View>
  );

  const facts = (
    <>
      <View style={styles.factBox}>
        <Eyebrow>{t('didYouKnow')}</Eyebrow>
        <Body style={styles.factText} testID="country-fact">{country.fact[cardLang]}</Body>
      </View>
      <View style={styles.rows}>
        <InfoRow label={t('capital')} value={country.capital[cardLang]} />
        <InfoRow label={t('continent')} value={continentNames[cardLang][country.continent]} />
        <InfoRow
          label={langs.length > 1 ? t('languages') : t('languageOne')}
          value={langs.slice(0, VISIBLE_LANGUAGES).join(', ') + (langs.length > VISIBLE_LANGUAGES ? ` ${t('moreLanguages', { n: langs.length - VISIBLE_LANGUAGES })}` : '')}
        />
      </View>
    </>
  );

  const map = (
    <View style={{ gap: space.sm }}>
      <Pressable
        testID="map-toggle"
        accessibilityRole="button"
        accessibilityLabel={zoomed ? t('zoomOut') : t('zoomIn')}
        onPress={() => setZoomed((z) => !z)}
        style={(state) => [(state as { focused?: boolean }).focused && styles.focus, { borderRadius: radius.md }]}>
        <WorldMap highlight={country.id} discovered={discovered} zoomTo={zoomed ? country.id : null} aspectRatio={wide ? 1.35 : 1.7} accessibilityLabel={t('mapOf', { name: country.name[cardLang] })} />
      </Pressable>
      <Muted style={{ textAlign: 'center' }}>{zoomed ? t('zoomOut') : t('zoomIn')} ⤢</Muted>
    </View>
  );

  const discoverMore = (
    <Card style={{ padding: 0, gap: 0 }}>
      <Pressable
        testID="discover-more"
        accessibilityRole="button"
        accessibilityState={{ expanded: more }}
        onPress={() => setMore((m) => !m)}
        style={(state) => [styles.moreHeader, (state as { focused?: boolean }).focused && styles.focus]}>
        <Text style={styles.moreTitle}>{t('discoverMore')}</Text>
        <Text style={styles.moreChevron}>{more ? '−' : '+'}</Text>
      </Pressable>
      {more ? (
        <View style={styles.moreBody}>
          <MoreItem title={t('culture')} text={country.culture[cardLang]} />
          <MoreItem title={t('food')} text={country.food[cardLang]} />
          <MoreItem title={`${t('sight')}: ${country.place[cardLang]}`} text={country.sight[cardLang]} />
          {langs.length > VISIBLE_LANGUAGES ? <MoreItem title={t('allLanguages')} text={langs.join(', ')} /> : null}
          {credit ? (
            <Pressable accessibilityRole="link" onPress={() => Linking.openURL(credit.sourceUrl).catch(() => {})}>
              <Muted style={{ fontSize: 12 }}>{t('photoBy', { author: credit.author, license: credit.license })} · <Text style={{ textDecorationLine: 'underline' }}>{t('photoSource')}</Text></Muted>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Card>
  );

  const discoverButton = found ? (
    <View style={styles.foundRow} testID="discovered-state">
      <View style={styles.foundBadge}>
        <Text style={styles.foundText}>✓ {t('discoveredDone')}</Text>
      </View>
      <Muted style={{ flex: 1 }}>{t('addedToMap')}</Muted>
      <Button label={t('undo')} variant="ghost" onPress={() => setCountryDiscovered(country.id, false)} testID="undo-discovered" />
    </View>
  ) : (
    <Button label={t('markDiscovered')} variant="success" onPress={() => setCountryDiscovered(country.id, true)} testID="mark-discovered" />
  );

  const photo = <CountryPhoto id={country.id} hiRes caption={country.place[cardLang]} sub={bothNames(country, cardLang)} aspectRatio={wide ? 16 / 10 : 4 / 3} missingLabel={t('photoUnavailable')} />;

  if (wide) {
    return (
      <View style={styles.wide} testID="country-card">
        <View style={{ flex: 1.15, gap: space.lg }}>
          {photo}
          {header}
          {facts}
          {discoverMore}
          {discoverButton}
        </View>
        <View style={{ flex: 1, gap: space.lg }}>{map}</View>
      </View>
    );
  }
  return (
    <View style={{ gap: space.lg }} testID="country-card">
      {photo}
      {header}
      {facts}
      {map}
      {discoverMore}
      {discoverButton}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function MoreItem({ title, text }: { title: string; text: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Eyebrow>{title}</Eyebrow>
      <Body>{text}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  wide: { flexDirection: 'row', gap: space.xl, alignItems: 'flex-start' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap' },
  name: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, fontWeight: '700', color: colors.ink },
  nameOther: { fontFamily: fonts.body, fontSize: 16, color: colors.inkSoft },
  factBox: { backgroundColor: colors.paperDeep, borderRadius: radius.md, padding: space.lg, gap: space.xs, borderLeftWidth: 4, borderLeftColor: colors.accent },
  factText: { fontSize: 17, lineHeight: 26 },
  rows: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  row: { flexDirection: 'row', paddingVertical: space.md, paddingHorizontal: space.lg, gap: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rowLabel: { width: 84, fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, paddingTop: 2 },
  rowValue: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.ink },
  moreHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space.lg, minHeight: 56 },
  moreTitle: { fontFamily: fonts.display, fontSize: 18, fontWeight: '700', color: colors.ink },
  moreChevron: { fontSize: 24, color: colors.ocean, fontWeight: '700' },
  moreBody: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.md },
  foundRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap' },
  foundBadge: { backgroundColor: colors.successWash, borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: space.sm, borderWidth: 1, borderColor: colors.success },
  foundText: { color: colors.success, fontWeight: '700', fontFamily: fonts.body, fontSize: 15 },
  focus: { outlineColor: colors.accent, outlineWidth: 3, outlineStyle: 'solid', outlineOffset: 2 } as object,
});
