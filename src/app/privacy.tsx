import React from 'react';
import { Body, Card, H2, Muted, Screen } from '../components/ui';
import type { Lang } from '../core/types';
import { useApp } from '../state/AppProvider';

/**
 * Privacy policy. Also served on the web at /privacy, which is the URL given to the App Store and
 * Google Play. Keep it in sync with what the app actually does (see README → Privacy).
 */
const POLICY: Record<Lang, { updated: string; sections: [string, string][] }> = {
  tr: {
    updated: 'Son güncelleme: 17 Kasım 2026',
    sections: [
      ['Özet', 'Dünya Cepte reklam göstermez, kullanıcıları izlemez ve verileri satmaz. Uygulamayı hesap açmadan kullanabilirsin; bu durumda ilerlemen yalnızca kendi cihazında saklanır.'],
      ['Cihazda saklanan veriler', 'Dil tercihi, hatırlatma saati, keşfettiğin ülkeler, günlük test ve gizem sonuçları ve oyunlarda karıştırdığın ülkeler cihazının depolamasında tutulur. Uygulamayı silmek bu verileri siler.'],
      ['İsteğe bağlı hesap', '“İlerlememi yedekle” ile giriş yaparsan e-posta adresin ve ilerlemen (keşfedilen ülkeler, günlük sonuçlar) hesabına bağlı olarak Supabase üzerinde saklanır. Bu veriler yalnızca cihazlar arasında eşitleme için kullanılır; veritabanı kuralları gereği her kullanıcı yalnızca kendi kayıtlarına erişebilir.'],
      ['Hesabı silme', 'Hesap ekranındaki “Hesabımı sil” düğmesi hesabını ve sunucudaki tüm ilerlemeni kalıcı olarak siler. Cihazındaki ilerleme misafir ilerlemesi olarak kalır.'],
      ['Bildirimler', 'Günlük hatırlatma varsayılan olarak kapalıdır. Açarsan bildirim cihazında yerel olarak zamanlanır; hiçbir sunucuya bilgi gönderilmez.'],
      ['Fotoğraflar ve ağ istekleri', 'Büyük ülke fotoğrafları Wikimedia Commons’tan (upload.wikimedia.org) yüklenir. Bu isteklerde Wikimedia, her web sitesinde olduğu gibi IP adresini ve tarayıcı bilgisini görebilir. Temel paket fotoğrafları uygulamanın içindedir.'],
      ['Çocuklar', 'Uygulama her yaştan kullanıcıya uygundur ve hesap açmak gerekmez. Bilerek 13 yaşından küçük çocuklardan kişisel veri toplamayız; hesap özelliği isteğe bağlıdır.'],
      ['İletişim', 'Sorular ve veri talepleri için proje sayfası: github.com/beza0/pocketWorld'],
    ],
  },
  en: {
    updated: 'Last updated: 17 November 2026',
    sections: [
      ['Summary', 'Pocket World shows no ads, does not track users and does not sell data. You can use the app without an account; your progress is then stored only on your own device.'],
      ['Data stored on your device', 'Your language, reminder time, discovered countries, daily quiz and mystery results and the countries you mixed up in games are kept in your device storage. Deleting the app deletes them.'],
      ['Optional account', 'If you sign in with “Back up my progress”, your e-mail address and your progress (discovered countries, daily results) are stored with Supabase, linked to your account. They are used only to sync between your devices; database rules ensure each user can access only their own records.'],
      ['Deleting your account', 'The “Delete my account” button on the account screen permanently deletes your account and all progress stored on the server. Progress on your device stays as guest progress.'],
      ['Notifications', 'The daily reminder is off by default. If you turn it on, the notification is scheduled locally on your device; nothing is sent to a server.'],
      ['Photos and network requests', 'Large country photos are loaded from Wikimedia Commons (upload.wikimedia.org). As with any website, Wikimedia can see your IP address and browser information for these requests. Base-pack photos are inside the app.'],
      ['Children', 'The app is suitable for all ages and needs no account. We do not knowingly collect personal data from children under 13; the account feature is optional.'],
      ['Contact', 'Questions and data requests: github.com/beza0/pocketWorld'],
    ],
  },
};

export default function PrivacyScreen() {
  const { lang } = useApp();
  const policy = POLICY[lang];
  return (
    <Screen maxWidth={720}>
      <Muted>{policy.updated}</Muted>
      {policy.sections.map(([title, text]) => (
        <Card key={title}>
          <H2>{title}</H2>
          <Body>{text}</Body>
        </Card>
      ))}
    </Screen>
  );
}
