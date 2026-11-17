# Yayın rehberi / Release guide

Bu klasör mağaza varlıklarını ve yayın adımlarını içerir. Yayın, mağaza hesapları ve ödeme gerektirdiği
için otomatik yapılmaz; aşağıdaki adımlar hesap sahibi tarafından çalıştırılır.

| Dosya | Kullanım |
| --- | --- |
| `listing/tr.md`, `listing/en.md` | Mağaza adı, alt başlık, açıklama, anahtar kelimeler |
| `screenshots/ios/<dil>/*.png` | App Store, 6.9" iPhone (1320 × 2868) |
| `screenshots/android/<dil>/*.png` | Google Play telefon (1080 × 2400) |
| `play-icon-512.png` | Google Play yüksek çözünürlüklü ikon |
| `play-feature-graphic.png` | Google Play öne çıkan görsel (1024 × 500) |

Ekran görüntüleri ve ikonlar betikle üretilir: `npm run brand:icons`, `npm run store:screenshots`
(önce `npm run build:web && npm run serve:web`).

## 0. Bir kez: hesaplar ve kimlikler

- Apple Developer Program (yıllık ücretli) ve Google Play Console (tek seferlik ücret) hesapları.
- Expo hesabı: `npx eas-cli@latest login`, sonra `npx eas-cli@latest init` (app.json'a `extra.eas.projectId` yazar).
- Paket kimlikleri `app.json` içinde: iOS `app.pocketworld`, Android `app.pocketworld`. Bu kimlikler
  mağazada başka bir uygulamaya aitse yayından **önce** kendi alan adınıza göre değiştirin
  (ör. `com.<sizin-alan-adiniz>.dunyacepte`); yayından sonra değiştirilemez.
- Supabase kullanılacaksa: iki migration'ı uygulayın, sonra EAS ortam değişkenlerini girin:
  `npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_URL --value ... --environment production --visibility plaintext`
  (anon anahtar için aynısı). Supabase yoksa uygulama misafir modunda eksiksiz çalışır ve hesap ekranı
  “yapılandırılmamış” mesajı gösterir.

## 1. Web

```bash
npm run build:web          # dist/
```

`dist/` herhangi bir statik barındırıcıya yüklenir. Hazır yapılandırmalar: `vercel.json` (Vercel),
`netlify.toml` + `public/_redirects` + `public/_headers` (Netlify, Cloudflare Pages). Gereken iki şey:
bilinmeyen yollar `index.html`'e düşmeli; `index.html`, `sw.js`, `offline-manifest.json` önbelleğe
alınmamalı. Service worker yalnızca HTTPS (veya localhost) üzerinde çalışır.
Gizlilik politikası adresi: `https://dunya-cepte.vercel.app/privacy` (kendi alan adınızı bağlarsanız onu kullanın) — mağaza formlarında bunu kullanın.

## 2. iOS — App Store

```bash
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios --profile production
```

EAS ilk derlemede sertifika ve provisioning profilini Apple hesabınızla oluşturur. App Store Connect'te:

- **App Privacy:** “Data Linked to You” → *Contact Info: Email Address* ve *User Content / Gameplay
  Content* (yalnızca hesap açılırsa; amaç: App Functionality). Takip yok. Uygulama içi
  `privacyManifests` (`app.json`) bununla uyumludur.
- **Yaş sınırı:** 4+ (şiddet, reklam, satın alma yok).
- **Hesap silme:** Hesap → “Hesabımı sil” (Guideline 5.1.1(v)).
- **Şifreleme:** `ITSAppUsesNonExemptEncryption = false` ayarlı.
- İnceleme notu: “Sign-in is optional. Every feature works as a guest.” Supabase yapılandırıldıysa
  inceleme için bir test e-postası verin (kod e-postayla gelir).

## 3. Android — Google Play

```bash
npx eas-cli@latest build --platform android --profile production   # .aab
npx eas-cli@latest submit --platform android --profile production  # internal track, draft
```

İlk yükleme Play Console'dan elle yapılmalıdır (Google'ın kuralı); sonrakiler `eas submit` ile.
`submit` için Play Console'da bir servis hesabı JSON anahtarı oluşturup EAS'a yükleyin. Play Console'da:

- **Data safety:** Toplanan veri yalnızca hesap açılırsa: *E-posta adresi* (Hesap yönetimi) ve
  *Uygulama etkinliği → diğer kullanıcı içeriği* (Uygulama işlevselliği); şifrelenerek aktarılır;
  kullanıcı silme isteyebilir (uygulama içinden). Paylaşılan veri yok.
- **Hesap silme URL'si:** uygulama içi yol + `https://dunya-cepte.vercel.app/privacy` (kendi alan adınızı bağlarsanız onu kullanın) (“Hesabı silme” bölümü).
- **İçerik derecelendirmesi:** Eğitim; tüm yaşlar.
- **Hedef kitle:** 13 yaş altı çocukları da hedefleyecekseniz “Aileler” politikası ek beyanlar ister;
  varsayılan öneri 13+ hedef kitle seçmektir (uygulama yine her yaşa uygundur).
- İzinler: yalnızca `INTERNET`, `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED` ve `VIBRATE` (günlük hatırlatma için);
  kesin alarm izinleri kapatıldı, ek beyan gerekmez.

## 4. Sürüm güncelleme

`app.json` → `version` (ör. 1.1.0). Derleme numaraları (`buildNumber`, `versionCode`) EAS'ta uzaktan
tutulur ve `production` profilinde otomatik artar. İçerik değiştiyse önce `npm run content:validate`.
