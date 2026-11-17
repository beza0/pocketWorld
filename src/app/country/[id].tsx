import * as Linking from 'expo-linking';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, Share } from 'react-native';
import { CountryCard, bothNames } from '../../components/CountryCard';
import { Button, Screen, StateView } from '../../components/ui';
import { getCountry } from '../../data';
import { useApp } from '../../state/AppProvider';

/** Shareable country page: /country/<iso alpha-2>. The id is language-independent and stable. */
export default function CountryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useApp();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const country = getCountry(Array.isArray(id) ? id[0] : id);

  if (!country) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('countryNotFound') }} />
        <StateView kind="error" title={t('countryNotFound')} message={t('countryNotFoundHint')} actionLabel={t('goCountries')} onAction={() => router.replace('/countries')} />
      </Screen>
    );
  }

  const share = async () => {
    const path = `/country/${country.id}`;
    try {
      if (Platform.OS === 'web') {
        const url = `${window.location.origin}${path}`;
        if (navigator.share) await navigator.share({ title: bothNames(country, lang), url });
        else {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        }
      } else {
        await Share.share({ message: `${bothNames(country, lang)} — ${Linking.createURL(path)}` });
      }
    } catch {
      /* the user dismissed the share sheet */
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: bothNames(country, lang) }} />
      <CountryCard key={country.id} country={country} />
      <Button label={copied ? t('linkCopied') : t('share')} variant="ghost" onPress={share} testID="share-country" />
    </Screen>
  );
}
