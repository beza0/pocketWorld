# İçerik hattı / Content pipeline

Everything the app shows about countries is produced by a versioned, reproducible pipeline.
Nothing in `src/data/generated/` or `assets/content/` is edited by hand.

```
content/editorial/*.txt      hand-written TR + EN texts (fact, culture, food, sight), Turkish capital name,
                             photographed place, Wikipedia article used to find the photo
content/overrides.json       documented corrections on top of world-countries (names, aliases, languages,
                             flag pairs that are practically identical)
content/languages.tr.json    Turkish names of languages
content/photo-overrides.json pinned Commons files / Commons searches for countries whose article image
                             was unusable (map, painting, satellite image, sign with the country name …)
content/photos.lock.json     provenance of every photo: Commons file, author, licence, licence URL,
                             source page, high-resolution URL, SHA-256 of the packaged file
content/calendar.json        the daily calendar (versioned, frozen)
content/calendar.lock.json   hash of each published calendar cycle
        │
        ├── scripts/content/fetch-photos.ts → assets/content/photos/<id>.webp (1200×800, WebP q68)
        ├── scripts/content/build.ts        → src/data/generated/*, assets/content/flags/<id>.png
        └── scripts/content/validate.ts     → fails on any missing / invalid / unlicensed item
```

## Sources

| Data | Source | Licence |
| --- | --- | --- |
| Country list, ISO codes, English names, capitals, languages, borders, coordinates | [world-countries](https://github.com/mledoze/countries) 5.1 (npm) | ODbL 1.0 |
| Turkish country names | world-countries `translations.tur`, with corrections in `overrides.json` | ODbL 1.0 |
| Map geometry | [Natural Earth](https://www.naturalearthdata.com/) via [world-atlas](https://github.com/topojson/world-atlas) 2.0 (1:50m, Tuvalu from 1:10m), simplified | Public domain |
| Flags | [flag-icons](https://github.com/lipis/flag-icons) 7.6, rasterised to 320×240 PNG | MIT |
| Photos | [Wikimedia Commons](https://commons.wikimedia.org/) — only CC0, public domain, CC BY, CC BY-SA | per file, see `photos.lock.json` |
| Short facts, culture, food, sight texts | written for this project (TR + EN) from general reference knowledge (Wikipedia, UNESCO lists) | project licence |

**Scope:** the 193 UN member states plus the two UN observer states, Palestine and the Holy See (Vatican).
world-countries marks the Holy See as `unMember: true`; we treat it as an observer.

**Names and borders policy:** English names are the common short names from world-countries; Turkish
names are world-countries' Turkish common names, with the corrections listed in `overrides.json`
(e.g. "Samoa" instead of the long official form, "Demokratik Kongo Cumhuriyeti"). The app always shows
both names together. Borders are drawn exactly as in Natural Earth's
*admin 0 countries* layer (de-facto boundaries). Areas that are not one of the 195 countries
(e.g. Western Sahara, Kosovo, Greenland) are drawn as neutral land and never highlighted.
Capitals: where a country has several capitals, all are listed (Bolivia, South Africa, Eswatini,
Sri Lanka); Palestine shows Ramallah as the administrative seat, Israel shows Jerusalem as given by the
source data.

## Editorial format

```
@jp | Tokyo | Mount Fuji | Fuji Dağı | Mount Fuji
F: <short fact TR> || <short fact EN>
C: <culture TR> || <culture EN>
Y: <food TR> || <food EN>
S: <sight TR> || <sight EN>
```

Header: `@id | capital in Turkish [= capital in English] | Wikipedia article | place TR | place EN`.
`F`, `C` and `Y` are used as quiz clues: the validator rejects them if they contain the country's
name, an alias, a name stem (e.g. "Japon") or the capital.

## Commands

```bash
npm run content:photos       # fetch missing photos (slow on purpose: 1 request / 2.5 s)
npm run content:build        # regenerate data, flags and asset maps
npm run content:validate     # validate everything (must pass before a release)
```

`fetch-photos.ts jp tr` re-fetches given countries; `--encode` re-encodes from the local cache only.

## Calendar

`content/calendar.json` holds one or more cycles: `{version, start, countryOrder[195], mysteryOrder[195]}`.
Day *n* of a cycle shows `countryOrder[n]` and `mysteryOrder[n]`; the two orders never use the same
country on the same day. A cycle repeats until a newer cycle starts. To change the order, **append** a
new cycle with a `start` date in the future and run `npm run content:validate -- --write-lock`; the
validator refuses any change to a cycle that is already locked, so published days never change.
