# Swipe Supper

Swipe recipes, plan the week, and get one merged shopping list grouped by store section. Metric units, made for shopping in Sweden.

- **Android app:** every push builds a debug APK in GitHub Actions (no Android Studio needed).
- **Web app / PWA:** published to GitHub Pages from `main`; open it in Chrome and choose *Install app*.
- **Online recipes:** about 620 recipes with photos from [TheMealDB](https://www.themealdb.com) are downloaded once and kept on the device, mixed into the deck alongside the 36 starters and your own recipes. Turn them off under *My recipes*.
- **Store offers:** pick your stores once (postcode or location), add offers you spot, and the shopping list shows *on offer at <store> until <date>* with validity dates and member prices. You also get the best store for the list and an *On sale* filter on the deck. No chain data is fetched automatically yet; see PLAN.txt for the data-source research.
- **Share with friends:** set your name under *My recipes*, open one of your recipes and tap *Share with friends*. The whole recipe travels inside the link, with no accounts or server. Friends open it to add it with your name on it, and filter the deck by friend (*Friends* and per-person chips). Photos are not included.
- **Import from recipe websites (Android app):** paste a recipe link (Köket, Arla, BBC Good Food and most sites with standard recipe data). The app reads that one page, converts Swedish and English amounts, merges known ingredients and opens the recipe in the editor for you to check. The photo is saved on the phone.
- Everything you save (kept recipes, week plan, list, your own recipes, photos) stays on the device. Use **My recipes → Save backup** to keep a copy.

## Install the APK on your phone

1. On your phone, open the repo's **Actions** tab on github.com (signed in), tap the latest green **Android APK** run.
2. Under **Artifacts**, download `swipe-supper-apk-<number>`. It arrives as a `.zip`.
3. Open the zip in the **Files** app and tap the `.apk` inside.
4. If Android asks, allow **Install unknown apps** for Files (or your browser), then tap **Install**.
5. Later builds install over the old one as updates and keep your data.

## Develop

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # web build in dist/
npm run android:sync # copy the web build into the Android project
```

- `src/data.js` – ingredient catalogue and starter recipes
- `src/main.js` – the app (deck, week, shopping list, my recipes, backup)
- `src/mealdb.js` – TheMealDB download and conversion (metric amounts, store sections, diet flags)
- `src/stores.js` – store picker (OpenStreetMap; list in `public/stores.json`, rebuilt monthly by the *Store list* workflow)
- `src/offers.js` – offer format, Swedish product-name matching, validity
- `src/importer.js` – recipe import from a web page (schema.org Recipe data, Swedish and English ingredient lines)
- `src/share.js` – recipe share links (compressed, validated on import) and opening them in the Android app
- `src/photos.js` – photo storage and cached data (IndexedDB)
- `src/backup.js` – backup file save/restore
- `scripts/make-icons.mjs` – renders all icons from `assets/icon.svg`; then `npx capacitor-assets generate --android`
- `legacy/swipe-supper.html` – the original single-file version

## Signing

CI signs debug APKs with one fixed key from the repository secrets `DEBUG_KEYSTORE_B64` and `DEBUG_KEYSTORE_PASSWORD`, so updates install over each other. The key is kept locally in `signing/` (git-ignored). Back that folder up: if the key is lost, the next APK can only be installed after uninstalling, which deletes the app's data.

## TheMealDB key

The app uses TheMealDB's free test key `1`, which TheMealDB allows for development and personal/educational use. Releasing on an app store requires their supporter key. To use one, add it as the repository secret `MEALDB_KEY` (CI builds pick it up) or put `VITE_MEALDB_KEY=...` in a local `.env` (git-ignored). Keys are never committed.
