# Dünya Cepte · Pocket World

Her gün bir ülke. *Bugün hangi ülkeyi öğreneceğim?* sorusuyla açılan, iOS, Android ve web'de çalışan bir
coğrafya öğrenme ve oyun uygulaması. Türkçe arayüzde **Dünya Cepte**, İngilizce arayüzde **Pocket World**.

A geography learning and quiz app for iOS, Android and the web, built with Expo, React Native,
TypeScript and Expo Router.

## Özellikler / Features

- **Bugün** — Günün Ülkesi (fotoğraf, bayrak, harita, başkent, kıta, diller, kısa bilgi, “Daha fazla
  keşfet”, “Keşfettim”), Bugünün 3 Sorusu (bayrak → harita → kısa bilgi) ve Günün Gizemi (3 ipucu,
  4 sabit şık, 3/2/1/0 puan). Önceki Günler listesi.
- **Ülkeler** — 195 ülke (193 BM üyesi + Filistin + Vatikan), TR/EN ve alternatif yazımlarla arama
  (`Türkiye`, `Turkiye`, `Turkey`), kıta filtresi, Keşif Haritam (`12 / 195 ülke keşfedildi`, kıta bazında).
  Paylaşılabilir adresler: `/country/<iso2>` (ör. `/country/jp`).
- **Oyna** — Bayrak, Harita, Kısa Bilgi, Fotoğraf, Karışık; Kolay / Zor; 10 soru; “Keşfettiklerim” havuzu;
  yanlış bilinen ülkeler sonraki turlarda farklı soru türüyle daha sık gelir (tur başına en fazla 3).
- Günlük içerik **Europe/Istanbul 00.00**'da değişir; cihaz saat diliminden bağımsızdır ve çevrimdışı çalışır.
- Varsayılan dil Türkçe, uygulama içinden İngilizce; ülke adları her yerde iki dilde; kartta geçici TR/EN okuma.
- Misafir kullanım, cihazda kalıcı ilerleme; isteğe bağlı giriş ve eşitleme (Supabase).
- Çevrimdışı: mobilde paket uygulamayla gelir; web'de “Çevrimdışı kullanıma hazırla”.
- Günlük hatırlatma (varsayılan kapalı, önerilen 09.00) — mobilde yerel bildirim.

## Kurulum ve çalıştırma / Setup

Gereksinimler: Node.js 22+, npm.

```bash
npm install
npm run web          # Expo dev server, web
npm run ios          # iOS simulator (macOS + Xcode)
npm run android      # Android emulator / device
```

`expo-notifications` yerel modül içerdiği için iOS/Android'de bildirimler Expo Go yerine bir geliştirme
derlemesinde (`npx expo run:ios` / `npx expo run:android` veya `eas build --profile development`) denenmelidir.

Yayın web derlemesi (çevrimdışı paket yalnızca bunda çalışır):

```bash
npm run build:web    # expo export + offline manifest → dist/
npm run serve:web    # dist/ on http://localhost:8080 (SPA fallback for /country/<id>)
```

Herhangi bir statik barındırıcı kullanılabilir; bilinmeyen yolların `index.html`'e düşmesi (SPA fallback),
`index.html`, `sw.js` ve `offline-manifest.json` için `no-cache` gerekir.

## Yayın / Release (web, App Store, Google Play)

Adım adım rehber, mağaza metinleri, ekran görüntüleri ve gizlilik beyanları: [`store/README.md`](store/README.md).
Kısaca:

```bash
npm run build:web                                                   # web → dist/ (Vercel / Netlify / Cloudflare yapılandırmaları hazır)
npx eas-cli@latest build --platform ios --profile production        # App Store
npx eas-cli@latest build --platform android --profile production    # Google Play (.aab)
npx eas-cli@latest submit --platform all --profile production
```

GitHub Actions: `CI` her push'ta tip denetimi, lint, test, içerik doğrulama ve web derlemesi yapar;
`EAS build` iş akışı elle tetiklenir (`EXPO_TOKEN` gizli değişkeni gerekir). Gizlilik politikası
uygulamada ve web'de `/privacy` adresindedir; hesap silme Hesap ekranındadır (mağaza zorunluluğu).

## Ortam değişkenleri / Environment variables

`.env.example` dosyasını `.env.local` olarak kopyalayın. Hepsi isteğe bağlıdır; boşken uygulama misafir
modunda tüm özellikleriyle çalışır.

| Değişken | Açıklama |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase projesinin URL'i |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable anahtarı (istemciye gömülmesi güvenli olan anahtar) |

**Service-role anahtarını asla istemciye veya repoya koymayın.** Erişim denetimi veritabanındaki satır
düzeyi güvenlik (RLS) politikalarıyla yapılır.

### Supabase kurulumu

1. Bir Supabase projesi oluşturun, `supabase/migrations/20261116000000_progress.sql` dosyasını uygulayın
   (`supabase db push` ya da SQL editörü).
2. Authentication → Providers → Email'de “Email OTP”yi açın; e-posta şablonunda `{{ .Token }}` (6 haneli
   kod) bulunsun. Uygulama derin bağlantı gerektirmeyen kodla giriş kullanır.
3. URL ve anon anahtarı `.env.local`'a yazın.

**Birleştirme kuralı** (istemci `src/core/progress.ts` ve sunucu `push_progress` aynı kuralı uygular):

- Keşifler ülke kimliğiyle tekildir; son değişiklik kazanır, eşit zaman damgasında “keşfedildi” kazanır.
  Aynı ülke iki cihazda keşfedilse de bir kez sayılır.
- Günlük sonuçlar `(tür, tarih)` ile tekildir; **ilk tamamlanan sonuç kazanır** (eşitlikte küçük
  `device_id`, sonra yüksek puan). Bu kural değişmeli, birleşmeli ve idempotenttir.
- Değişiklikler `pending` kuyruğunda bekler, yalnızca başarılı gönderimden sonra silinir; gönderim
  idempotent bir upsert olduğundan yeniden denemeler yinelenen kayıt üretmez. Giriş yapıldığında,
  uygulama öne geldiğinde, tarayıcı yeniden çevrimiçi olduğunda ve her değişiklikten sonra eşitlenir.

## İçerik üretimi ve doğrulama / Content

Ayrıntılar: [`content/README.md`](content/README.md).

```bash
npm run content:photos     # Wikimedia Commons'tan eksik fotoğrafları indirir (lisans + atıf kaydıyla)
npm run content:build      # veri, bayrak, harita ve takvim çıktıları
npm run content:validate   # 195 ülke, iki dil, varlıklar, şıklar, lisanslar, takvim kilidi
```

Doğrulama şunları denetler: 193 BM üyesi + 2 gözlemci; her alanın TR ve EN dolu ve farklı olması;
ipucu metinlerinde ülke adı, adın kökü, takma adlar veya başkentin geçmemesi; tüm adlarla aramanın doğru
ülkeyi ilk sırada bulması; her ülkenin harita geometrisi ve küçük ülkeler için işaretçi; takvimin her 195
günlük döngüde her ülkeyi tam bir kez göstermesi ve aynı gün iki serinin farklı olması; yayımlanmış
takvim döngülerinin değişmemesi; her ülke × 4 soru türü × 2 zorluk için geçerli dört şıklı sorular
(Zor'da komşu / benzer bayrak, Kolay'da başka kıtalar, ayırt edilemeyen bayrakların asla birlikte
çıkmaması); fotoğrafların dosya bütünlüğü (SHA-256), lisansı, yazarı ve kaynağı; paket boyutu.

## Test / Tests

```bash
npm run typecheck
npm run lint
npm test                               # vitest: takvim, gizem puanı, arama, sorular, birleştirme/eşitleme
npm run content:validate
npm run build:web && npm run serve:web # sonra ayrı terminalde:
node scripts/e2e/web.e2e.cjs           # Playwright: misafir akışı, gizem kalıcılığı, saat dilimi, çevrimdışı
```

## Mimari / Architecture

```
src/app/            Expo Router ekranları: (tabs)/index · countries · play, country/[id], mystery,
                    previous, atlas, round, settings, account
src/core/           platformdan bağımsız mantık: takvim, soru üretimi, gizem, arama, ilerleme, eşitleme
src/components/     kart, harita (SVG, etiketsiz), bayrak, fotoğraf, quiz bileşenleri
src/platform/       adaptörler: storage, notifications(.web), offline(.web)
src/services/       Supabase istemcisi ve RemoteStore
src/data/generated/ içerik hattının çıktıları (elle düzenlenmez)
public/sw.js        web service worker (yalnızca doğrulanmış paketten sunar)
supabase/           veritabanı şeması ve RLS politikaları
```

- Harita, Natural Earth sınırlarından üretilmiş tek bir SVG'dir; üzerinde hiçbir ad yazmaz, bu yüzden
  soru ipucu olarak güvenle kullanılır. Küçük ve ada ülkeleri dünya ölçeğinde halka işaretçiyle gösterilir;
  karta dokununca ülkenin bölgesine yakınlaşılır.
- Web çevrimdışı paketi: `offline-manifest.json` her dosyanın boyutunu ve SHA-256'sını listeler. Dosyalar
  sürüm adlı yeni bir önbelleğe indirilir, her biri doğrulanır ve ancak ondan sonra etkin pakete geçilir;
  önceki paket o ana kadar hizmet vermeye devam eder. Büyük fotoğraflar (Wikimedia) ayrı bir önbellekte
  tutulur ve Ayarlar'dan temel içeriğe dokunmadan temizlenebilir.
- Bildirimler: iOS/Android'de `expo-notifications` ile cihaz üzerinde günlük yerel bildirim; metin
  seçili dildedir ve ülkeyi ya da gizemin cevabını söylemez; dokununca Bugün açılır. **Web'de** sayfa
  kapalıyken zamanlanmış bildirim için Web Push (service worker `push` olayı, VAPID anahtarları ve
  sunucu tarafında bir zamanlayıcı) gerekir; bu projede bu altyapı olmadığından web'de hatırlatma
  “desteklenmiyor” olarak gösterilir.

## Ölçülen boyutlar / Measured sizes

`src/data/generated/meta.json` (içerik) ve `npm run build:web` çıktısı (web paketi) gerçek değerleri verir.
Teslim anındaki değerler için aşağıdaki doğrulama durumu bölümüne bakın.

## Medya atıfları / Media credits

- Fotoğraflar: Wikimedia Commons. Her fotoğrafın yazarı, lisansı ve kaynak bağlantısı ülke kartında
  (“Daha fazla keşfet” altında) ve `content/photos.lock.json` içinde yer alır. Yalnızca CC0, kamu malı,
  CC BY ve CC BY-SA lisanslı dosyalar kullanılır; CC BY-SA dosyaların küçültülmüş/kırpılmış hâlleri aynı
  lisansla dağıtılır.
- Harita: Natural Earth (kamu malı) — world-atlas.
- Bayraklar: flag-icons (MIT).
- Ülke verileri: world-countries (ODbL 1.0) — değişiklikler `content/overrides.json` içinde.

## Doğrulama durumu / Verification status

Bkz. teslim notu (son commit mesajı ve PR açıklaması). Özet: web (Chromium, mobil ve geniş görünüm)
uçtan uca doğrulandı; iOS ve Android bu ortamda simülatör/cihaz olmadığı için çalıştırılmadı — tip
denetimi, lint ve platformdan bağımsız mantığın testleri her platform için geçerlidir.
