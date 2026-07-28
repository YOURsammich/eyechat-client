import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Standalone client config — used only when Vite runs from *inside*
// eyechat-client (`npm run dev` / `npm run build` here). The production build
// still comes from the parent eyechat-server checkout, whose own vite.config.js
// sets `root: 'eyechat-client'` and is the one resolved when Vite runs from
// there. Vite picks its config file out of the working directory, so the two
// never collide — but the build options below are kept in sync with the
// parent's on purpose. If you change one, change the other.
//
// This exists so someone with only the eyechat-client repo can work on the UI:
// `npm install && npm run dev` serves the SPA with HMR and forwards every API
// call to a real server, instead of having to hand-roll a manifest and a proxy.

// Where API calls go. Defaults to a server on this machine (index.js listens on
// port 80); point it at a deployed instance with:
//   VITE_API_TARGET=https://chat.example.com npm run dev
const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost:80';

// Everything the SPA fetches that the dev server can't serve itself: the REST
// routes from src/routes/*.js plus /images, which is where uploaded emojis,
// hats and avatars are served from.
const API_ROUTES = [
  '/a',
  '/channel',
  '/preconnect',
  '/login',
  '/logout',
  '/set-nick',
  '/search',
  '/wordstats',
  '/images',
];

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: Object.fromEntries(
      API_ROUTES.map((route) => [route, { target: API_TARGET, changeOrigin: true }]),
    ),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    minify: false,
    // Matches the parent config: maps are ~2/3 of the build output and were
    // killing the production build, so they're opt-in via VITE_SOURCEMAP=1.
    sourcemap: !!process.env.VITE_SOURCEMAP,
    rollupOptions: {
      input: {
        main: './index.html',
        search: './search.html',
        wordstats: './wordstats.html',
      },
    },
  },
});
