import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';

const root = fileURLToPath(new URL('.', import.meta.url));

// Multi-page build: the chat SPA (index.html) and the standalone log-search app
// (search.html), which reuses the chat's message-rendering components so search
// results look exactly like the chat. `emptyOutDir: false` protects the
// hand-edited static files in dist/ (theme.css, chat-messages.css) from being
// wiped on each build.
export default defineConfig({
  plugins: [react()],
  build: {
    emptyOutDir: false,
    rollupOptions: {
      input: {
        main: root + 'index.html',
        search: root + 'search.html',
      },
    },
  },
});
