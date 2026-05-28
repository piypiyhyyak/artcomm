import { defineConfig } from 'vite';
import { adminApiPlugin } from './vite.adminApiPlugin.js';

export default defineConfig({
  plugins: [adminApiPlugin()],
  assetsInclude: ['**/*.glb'],
  server: {
    host: true,
    port: 5173
  }
});
