import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { Country, Lang } from '../core/types';
import { attributions, geo } from '../data';
import { type StringKey, continentNames, translate } from '../i18n/strings';
import { useApp } from '../state/AppProvider';
import { colors, fonts, radius, space } from '../theme';
import { CountryPhoto } from './CountryPhoto';
import { Flag } from './Flag';
import { WorldMap } from './WorldMap';
import { Body, Button, Segmented, useIsWide } from './ui';

const VISIBLE_LANGUAGES = 3;

/** Both names, always: the card language first, the other one after the dot. */
export const bothNames = (c: Country, lang: Lang) => (lang === 'tr' ? `${c.name.tr} · ${c.name.en}` : `${c.name.en} · ${c.name.tr}`);

/**
 * Country card. Reading order: photo with name and flag → short fact → capital / continent /
 * languages → map → "Discover more" → "Keşfettim". On wide screens the map and `aside`
 * (e.g. today's tasks) sit in a second column.
 */
export function CountryCard({ country, eyebrow, aside }: { country: Country; eyebrow?: string; aside?: React.ReactNode }) {
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
  const otherLang: Lang = cardLang === 'tr' ? 'en' : 'tr';
  // small and mid-sized countries open zoomed in; the world view stays one tap away
  const canZoom = geo.countries[country.id]?.z[2] < 1200;

  const hero = (
    <CountryPhoto id={country.id} hiRes label={country.place[cardLang]} aspectRatio={wide ? 4 / 3 : 5 / 4} missingLabel={t('photoUnavailable')}>
      <View style={styles.heroTop}>
        <Segmented
          testID="card-lang"
          label={translate(lang, 'cardLanguage')}
          value={cardLang}
          onChange={setCardLang}
          options={[{ value: 'tr', label: 'TR' }, { value: 'en', label: 'EN' }]}
          style={styles.langToggle}
        />
      </View>
      <View style={styles.heroBottom}>
        {eyebrow ? <Text style={styles.heroEyebrow}>{eyebrow}</Text> : null}
        <View style={styles.heroNameRow}>
          <Flag id={country.id} width={52} label={t('flagOf', { name: country.name[cardLang] })} style={styles.heroFlag} />
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={styles.heroName} testID="country-name">{country.name[cardLang]}</Text>
            <Text style={styles.heroOther} testID="country-name-other">{country.name[otherLang]}</Text>
          </View>
        </View>
        <Text style={styles.heroPlace} numberOfLines={1}>{country.place[cardLang]}</Text>
      </View>
    </CountryPhoto>
  );

  const fact = <Text style={styles.fact} testID="country-fact">{country.fact[cardLang]}</Text>;

  const stats = (
    <View style={styles.stats}>
      <Stat label={t('capital')} value={country.capital[cardLang]} />
      <Stat label={t('continent')} value={continentNames[cardLang][country.continent]} />
      <Stat
        label={langs.length > 1 ? t('languages') : t('languageOne')}
        value={langs.slice(0, VISIBLE_LANGUAGES).join(', ') + (langs.length > VISIBLE_LANGUAGES ? ` ${t('moreLanguages', { n: langs.length - VISIBLE_LANGUAGES })}` : '')}
      />
    </View>
  );

  const map = (
    <View>
      <WorldMap highlight={country.id} discovered={discovered} zoomTo={zoomed ? country.id : null} aspectRatio={wide ? 1.3 : 1.8} accessibilityLabel={t('mapOf', { name: country.name[cardLang] })} />
      {canZoom ? (
        <Pressable
          testID="map-toggle"
          accessibilityRole="button"
          accessibilityLabel={zoomed ? t('zoomOut') : t('zoomIn')}
          onPress={() => setZoomed((z) => !z)}
          style={(state) => [styles.mapButton, (state as { focused?: boolean }).focused && styles.focus]}>
          <Text style={styles.mapButtonText}>{zoomed ? t('zoomOut') : t('zoomIn')}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const discoverMore = (
    <View style={styles.more}>
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
          <MoreItem title={`${t('sight')} · ${country.place[cardLang]}`} text={country.sight[cardLang]} />
          {langs.length > VISIBLE_LANGUAGES ? <MoreItem title={t('allLanguages')} text={langs.join(', ')} /> : null}
        </View>
      ) : null}
    </View>
  );

  const discoverButton = found ? (
    <View style={styles.foundRow} testID="discovered-state">
      <Text style={styles.foundText}>✓ {t('discoveredDone')}</Text>
      <Text style={styles.foundHint}>{t('addedToMap')}</Text>
      <Pressable accessibilityRole="button" onPress={() => setCountryDiscovered(country.id, false)} testID="undo-discovered" style={styles.undo}>
        <Text style={styles.undoText}>{t('undo')}</Text>
      </Pressable>
    </View>
  ) : (
    <Button label={t('markDiscovered')} variant="success" onPress={() => setCountryDiscovered(country.id, true)} testID="mark-discovered" />
  );

  const creditLine = credit ? (
    <Pressable accessibilityRole="link" onPress={() => Linking.openURL(credit.sourceUrl).catch(() => {})}>
      <Text style={styles.credit} numberOfLines={2}>{t('photoBy', { author: credit.author, license: credit.license })}</Text>
    </Pressable>
  ) : null;

  if (wide) {
    return (
      <View style={styles.wide} testID="country-card">
        <View style={{ flex: 1.15, gap: space.lg }}>
          {hero}
          {fact}
          {stats}
          {discoverButton}
          {discoverMore}
          {creditLine}
        </View>
        <View style={{ flex: 1, gap: space.lg }}>
          {map}
          {aside}
        </View>
      </View>
    );
  }
  return (
    <View style={{ gap: space.lg }} testID="country-card">
      {hero}
      {fact}
      {stats}
      {map}
      {discoverButton}
      {discoverMore}
      {creditLine}
      {aside}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function MoreItem({ title, text }: { title: string; text: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.moreItemTitle}>{title}</Text>
      <Body>{text}</Body>
    </View>
  );
}

const shadowText = { textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } };

const styles = StyleSheet.create({
  wide: { flexDirection: 'row', gap: space.xxl, alignItems: 'flex-start' },
  heroTop: { position: 'absolute', top: space.md, right: space.md },
  langToggle: { backgroundColor: 'rgba(255,253,248,0.92)', borderColor: 'transparent' },
  heroBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.lg, gap: space.sm },
  heroEyebrow: { color: '#F3E7CF', fontFamily: fonts.body, fontSize: 13, fontWeight: '700', letterSpacing: 0.3, ...shadowText },
  heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  heroFlag: { borderColor: 'rgba(255,255,255,0.7)' },
  heroName: { color: colors.white, fontFamily: fonts.display, fontSize: 34, lineHeight: 38, fontWeight: '700', ...shadowText },
  heroOther: { color: '#E8EEF7', fontFamily: fonts.body, fontSize: 16, ...shadowText },
  heroPlace: { color: '#E8EEF7', fontFamily: fonts.body, fontSize: 13, opacity: 0.9, ...shadowText },
  fact: { fontFamily: fonts.display, fontSize: 20, lineHeight: 29, color: colors.ink },
  stats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md, columnGap: space.lg, paddingVertical: space.md, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  stat: { flexGrow: 1, flexBasis: 90, gap: 2 },
  statLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, fontWeight: '600' },
  statValue: { fontFamily: fonts.body, fontSize: 16, color: colors.ink, fontWeight: '600' },
  mapButton: { position: 'absolute', right: space.sm, bottom: space.sm, backgroundColor: 'rgba(255,253,248,0.95)', borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 6, borderWidth: 1, borderColor: colors.line },
  mapButtonText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.ink },
  more: { borderBottomWidth: 1, borderColor: colors.line },
  moreHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.md, minHeight: 48 },
  moreTitle: { fontFamily: fonts.body, fontSize: 16, fontWeight: '700', color: colors.ink },
  moreChevron: { fontSize: 22, color: colors.ocean, fontWeight: '700' },
  moreBody: { paddingBottom: space.lg, gap: space.lg },
  moreItemTitle: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.oceanDeep },
  foundRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap', minHeight: 48, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: colors.successWash },
  foundText: { color: colors.success, fontWeight: '700', fontFamily: fonts.body, fontSize: 15 },
  foundHint: { flex: 1, color: colors.inkSoft, fontFamily: fonts.body, fontSize: 13 },
  undo: { paddingVertical: space.sm, paddingHorizontal: space.sm },
  undoText: { color: colors.ink, fontFamily: fonts.body, fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
  credit: { fontFamily: fonts.body, fontSize: 11, color: colors.inkFaint },
  focus: { outlineColor: colors.accent, outlineWidth: 3, outlineStyle: 'solid', outlineOffset: 2 } as ViewStyle,
});
