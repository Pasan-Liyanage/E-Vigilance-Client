import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';

const API_TARGET = process.env.VITE_API_PROXY || 'http://localhost:5050';

// GitHub Pages serves a project site from /<repo>/, so every absolute asset
// path has to carry that prefix. Locally and in Docker this stays '/'.
//   BASE_PATH=/E-Vigilance-Client/ npm run build
const BASE = process.env.BASE_PATH || '/';
const withBase = (p) => `${BASE}${p.replace(/^\//, '')}`;

// `npm run dev:https` serves over HTTPS with a self-signed certificate, which
// browsers require before granting camera, microphone or GPS on a real phone.
const HTTPS = process.env.HTTPS === 'true';

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    ...(HTTPS ? [basicSsl()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-64.png', 'apple-touch-icon.png'],
      manifest: {
        // A stable id keeps this the *same* installed app across deploys.
        id: withBase('?source=pwa'),
        name: 'E-Vigilance - Report Traffic Violations',
        short_name: 'E-Vigilance',
        description:
          'Report traffic violations with photo, video and voice evidence, and follow your case status.',
        theme_color: '#2540b2',
        background_color: '#0b1020',
        display: 'standalone',
        // Chrome installs a real app (WebAPK) rather than a bookmark shortcut
        // when the manifest asks for a standalone window like this.
        display_override: ['standalone', 'minimal-ui'],
        launch_handler: { client_mode: 'navigate-existing' },
        orientation: 'portrait',
        start_url: BASE,
        scope: BASE,
        lang: 'en',
        dir: 'ltr',
        prefer_related_applications: false,
        categories: ['government', 'utilities'],
        icons: [
          { src: withBase('icon-192.png'), sizes: '192x192', type: 'image/png' },
          { src: withBase('icon-512.png'), sizes: '512x512', type: 'image/png' },
          { src: withBase('icon-maskable-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Report a violation', short_name: 'Report', url: withBase('report') },
          { name: 'My reports', short_name: 'Reports', url: withBase('reports') },
        ],
        // Screenshots turn Chrome's minimal install bar into the full
        // "Install app" dialog, the one that creates a real app entry.
        screenshots: [
          { src: withBase('screenshots/phone-1-dashboard.png'), sizes: '1080x1920', type: 'image/png', form_factor: 'narrow', label: 'Your dashboard and report history' },
          { src: withBase('screenshots/phone-2-report.png'), sizes: '1080x1920', type: 'image/png', form_factor: 'narrow', label: 'Capture photo, video and voice evidence' },
          { src: withBase('screenshots/phone-3-detail.png'), sizes: '1080x1920', type: 'image/png', form_factor: 'narrow', label: 'Track the status of every report' },
          { src: withBase('screenshots/desktop-1-dashboard.png'), sizes: '1920x1080', type: 'image/png', form_factor: 'wide', label: 'Dashboard' },
          { src: withBase('screenshots/desktop-2-reports.png'), sizes: '1920x1080', type: 'image/png', form_factor: 'wide', label: 'My reports' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}', 'icon-*.png', 'favicon-*.png', 'apple-touch-icon.png'],
        navigateFallback: `${BASE}index.html`,
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Evidence media - cache first, it never changes once uploaded.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/media/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'evigilance-media',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // API reads - fresh when online, last-known copy when offline.
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/media/'),
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'evigilance-api',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      // Without this the dev server ships no manifest at all, so Chrome can
      // only offer a bookmark shortcut - never a real app install.
      devOptions: { enabled: true, type: 'module', navigateFallback: 'index.html' },
    }),
  ],
  server: {
    port: 5173,
    host: true, // listen on the LAN so a real phone can test camera/GPS
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
  preview: {
    port: 4173,
    host: true,
    proxy: { '/api': { target: API_TARGET, changeOrigin: true } },
  },
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 900 },
});
