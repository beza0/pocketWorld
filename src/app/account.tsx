import React, { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { Body, Button, Card, H2, Muted, Screen } from '../components/ui';
import { getSupabase } from '../services/supabase';
import { useApp } from '../state/AppProvider';
import { colors, fonts, radius, space } from '../theme';

/**
 * Optional sign-in ("İlerlememi yedekle"). Uses a one-time e-mail code, so the same flow works on
 * iOS, Android and web without deep-link configuration. Signing in triggers a sync that merges the
 * guest progress of this device into the account.
 */
export default function AccountScreen() {
  const { t, email, syncConfigured, syncState, syncNow, signOut, discovered, progress } = useApp();
  const [address, setAddress] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  if (!syncConfigured) {
    return (
      <Screen maxWidth={560}>
        <Card testID="account-not-configured">
          <H2>{t('backup')}</H2>
          <Body>{t('syncNotConfigured')}</Body>
          <Muted>{t('accountGuest')}</Muted>
        </Card>
      </Screen>
    );
  }

  if (email) {
    return (
      <Screen maxWidth={560}>
        <Card>
          <H2>{t('accountSignedIn', { email })}</H2>
          <Muted>{syncState === 'syncing' ? t('syncing') : syncState === 'error' ? t('syncError') : progress.pending.length ? t('syncPending', { n: progress.pending.length }) : t('discoveredCount', { n: discovered.length, total: 195 })}</Muted>
          <Button label={t('syncNow')} onPress={syncNow} disabled={syncState === 'syncing'} />
          <Button label={t('signOut')} variant="ghost" onPress={signOut} />
        </Card>
      </Screen>
    );
  }

  const run = async (fn: () => Promise<{ error: unknown }>, after?: () => void) => {
    setBusy(true);
    setError(false);
    try {
      const res = await fn();
      if (res.error) setError(true);
      else after?.();
    } catch {
      setError(true);
    }
    setBusy(false);
  };
  const db = getSupabase()!;

  return (
    <Screen maxWidth={560}>
      <Card>
        <H2>{t('backup')}</H2>
        <Muted>{t('mergeNote')}</Muted>
        <TextInput
          testID="auth-email"
          style={styles.input}
          value={address}
          onChangeText={setAddress}
          placeholder={t('email')}
          placeholderTextColor={colors.inkFaint}
          accessibilityLabel={t('email')}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
        />
        {!sent ? (
          <Button label={t('sendCode')} disabled={busy || !/^\S+@\S+\.\S+$/.test(address)} onPress={() => run(() => db.auth.signInWithOtp({ email: address.trim() }), () => setSent(true))} testID="auth-send" />
        ) : (
          <>
            <Muted>{t('codeSent')}</Muted>
            <TextInput testID="auth-code" style={styles.input} value={code} onChangeText={setCode} placeholder={t('code')} placeholderTextColor={colors.inkFaint} accessibilityLabel={t('code')} keyboardType="number-pad" autoComplete="one-time-code" />
            <Button label={t('verify')} disabled={busy || code.trim().length < 6} onPress={() => run(() => db.auth.verifyOtp({ email: address.trim(), token: code.trim(), type: 'email' }))} testID="auth-verify" />
          </>
        )}
        {error ? <Muted style={{ color: colors.danger }} accessibilityLiveRegion="polite">{t('authError')}</Muted> : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 50, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card, paddingHorizontal: space.lg, fontSize: 16, color: colors.ink, fontFamily: fonts.body },
});
