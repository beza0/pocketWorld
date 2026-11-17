import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { Body, Button, Card, H2, Muted, ProgressBar, Screen, Segmented } from '../components/ui';
import { contentMeta } from '../data';
import { formatBytes, formatTime } from '../i18n/format';
import { notifications } from '../platform/notifications';
import { offline } from '../platform/offline';
import type { OfflineStatus } from '../platform/offline.types';
import { useApp } from '../state/AppProvider';
import { colors, fonts, space } from '../theme';

export default function SettingsScreen() {
  const { t, lang, setLang, reminder, setReminder, email, syncConfigured, syncState, syncedAt, syncNow, signOut, progress } = useApp();
  const router = useRouter();
  const canSchedule = notifications.support().scheduled;
  const [denied, setDenied] = useState(false);
  const [status, setStatus] = useState<OfflineStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [cleared, setCleared] = useState(false);

  const refresh = useCallback(() => { offline.getStatus().then(setStatus).catch(() => {}); }, []);
  useEffect(refresh, [refresh]);

  const applyReminder = async (next: typeof reminder) => {
    const ok = await setReminder(next);
    setDenied(next.enabled && !ok);
  };
  const shift = (minutes: number) => {
    const total = (reminder.hour * 60 + reminder.minute + minutes + 1440) % 1440;
    applyReminder({ ...reminder, hour: Math.floor(total / 60), minute: total % 60 });
  };

  const prepare = async () => {
    setBusy(true);
    setCleared(false);
    const final = await offline.prepare(setStatus);
    setStatus(final);
    setBusy(false);
  };

  const state = status?.state;

  return (
    <Screen maxWidth={720}>
      <Card>
        <H2>{t('language')}</H2>
        <Segmented testID="ui-lang" label={t('language')} value={lang} onChange={setLang} options={[{ value: 'tr', label: t('langTr') }, { value: 'en', label: t('langEn') }]} />
      </Card>

      <Card testID="settings-account">
        <H2>{t('account')}</H2>
        {!syncConfigured ? <Muted>{t('syncNotConfigured')}</Muted> : email ? (
          <>
            <Body>{t('accountSignedIn', { email })}</Body>
            <Muted>{syncState === 'syncing' ? t('syncing') : syncState === 'error' ? t('syncError') : syncedAt ? t('syncedAt', { time: new Date(syncedAt).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB') }) : t('syncNever')}</Muted>
            {progress.pending.length > 0 ? <Muted>{t('syncPending', { n: progress.pending.length })}</Muted> : null}
            <View style={styles.rowWrap}>
              <Button label={t('syncNow')} variant="secondary" onPress={syncNow} disabled={syncState === 'syncing'} />
              <Button label={t('signOut')} variant="ghost" onPress={signOut} />
            </View>
          </>
        ) : (
          <>
            <Muted>{t('accountGuest')}</Muted>
            <Button label={t('backup')} variant="secondary" onPress={() => router.push('/account')} testID="settings-sign-in" />
          </>
        )}
      </Card>

      <Card testID="settings-reminder">
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <H2>{t('reminder')}</H2>
            <Muted>{t('reminderDesc')}</Muted>
          </View>
          <Switch
            testID="reminder-switch"
            accessibilityLabel={t('reminder')}
            value={canSchedule && reminder.enabled}
            disabled={!canSchedule}
            onValueChange={(enabled) => applyReminder({ ...reminder, enabled })}
            trackColor={{ true: colors.ocean, false: colors.line }}
          />
        </View>
        {!canSchedule ? <Muted testID="reminder-unsupported">{t('reminderWebUnsupported')}</Muted> : (
          <>
            <View style={styles.timeRow} accessibilityLabel={t('reminderTime')}>
              <Text style={styles.timeLabel}>{t('reminderTime')}</Text>
              <Button label="−" variant="secondary" onPress={() => shift(-15)} accessibilityLabel={`${t('reminderTime')} −15`} style={styles.step} />
              <Text style={styles.time} testID="reminder-time">{formatTime(reminder.hour, reminder.minute)}</Text>
              <Button label="+" variant="secondary" onPress={() => shift(15)} accessibilityLabel={`${t('reminderTime')} +15`} style={styles.step} />
            </View>
            {reminder.enabled ? <Muted>{t('reminderOn', { time: formatTime(reminder.hour, reminder.minute) })}</Muted> : null}
            {denied ? <Muted style={{ color: colors.danger }}>{t('reminderDenied')}</Muted> : null}
          </>
        )}
      </Card>

      <Card testID="settings-offline">
        <H2>{t('offline')}</H2>
        {state === 'bundled' ? <Body>{t('offlineNativeReady')}</Body> : null}
        {state === 'ready' ? <Body style={{ color: colors.success, fontWeight: '700' }} testID="offline-ready">✓ {t('offlineReady')}</Body> : null}
        {state === 'not-ready' ? <Body testID="offline-not-ready">{t('offlineNotReady')}</Body> : null}
        {state === 'update-available' ? <Body>{t('offlineUpdate')}</Body> : null}
        {state === 'failed' ? <Body style={{ color: colors.danger }} testID="offline-failed">{t('offlineFailed')}</Body> : null}
        {state === 'unsupported' ? <Muted testID="offline-unsupported">{typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? t('offlineDevNote') : t('offlineUnsupported')}</Muted> : null}
        {state === 'downloading' ? (
          <View style={{ gap: space.sm }} testID="offline-downloading">
            <Body>{t('offlinePreparing', { pct: Math.round((status?.progress ?? 0) * 100) })}</Body>
            <ProgressBar value={status?.progress ?? 0} color={colors.ocean} />
          </View>
        ) : null}
        {state === 'verifying' ? <Body>{t('offlineVerifying')}</Body> : null}
        {(state === 'not-ready' || state === 'failed' || state === 'update-available') && !busy ? (
          <Button label={state === 'update-available' ? t('offlineUpdateBtn') : t('offlinePrepare')} onPress={prepare} testID="offline-prepare" />
        ) : null}
        {status ? <Muted testID="pack-size">{t('packSize', { size: formatBytes(status.packBytes) })}</Muted> : null}
        <Muted>{t('packVersion', { v: status?.version ?? contentMeta.contentVersion })}</Muted>
        {status && status.photoCacheBytes !== null ? <Muted testID="photo-cache-size">{t('photoCache', { size: formatBytes(status.photoCacheBytes) })}</Muted> : null}
        {state !== 'unsupported' ? (
          <Button
            label={t('clearPhotoCache')}
            variant="secondary"
            onPress={async () => { await offline.clearPhotoCache(); setCleared(true); refresh(); }}
            testID="clear-photo-cache"
          />
        ) : null}
        {cleared ? <Muted testID="photo-cache-cleared">{t('photoCacheCleared')}</Muted> : null}
      </Card>

      <Card>
        <H2>{t('credits')}</H2>
        <Muted>{t('creditsBody')}</Muted>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowWrap: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap' },
  timeLabel: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.ink, minWidth: 120 },
  time: { fontFamily: fonts.display, fontSize: 24, fontWeight: '700', color: colors.ink, minWidth: 72, textAlign: 'center' },
  step: { minWidth: 48, paddingHorizontal: 0 },
});
