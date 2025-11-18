import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'plausible-domain-replace',
      transformIndexHtml(html) {
        const domain = process.env.VITE_PLAUSIBLE_DOMAIN || 'localhost';
        return html.replace('__PLAUSIBLE_DOMAIN__', domain);
      },
    },
  ],
  server: {
    port: 5173,
  },
});

