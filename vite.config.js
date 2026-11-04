import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

// Relative base so the same build works in the Android app (Capacitor) and on GitHub Pages under /swipe-supper/.
export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null, // registered from main.js, and only outside the Android app
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: './',
        name: 'Swipe Supper',
        short_name: 'Swipe Supper',
        description: 'Swipe recipes, plan the week and get one merged shopping list.',
        lang: 'en',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#EEF1EA',
        theme_color: '#EEF1EA',
        icons: [
          {src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png'},
          {src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png'},
          {src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'}
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        cleanupOutdatedCaches: true,
        // Recipe photos from TheMealDB stay available offline once seen.
        runtimeCaching: [{
          urlPattern: /^https:\/\/www\.themealdb\.com\/images\//,
          handler: 'CacheFirst',
          options: {cacheName: 'mealdb-images', expiration: {maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 90}, cacheableResponse: {statuses: [0, 200]}}
        }]
      }
    })
  ]
});
