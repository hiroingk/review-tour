import { fileURLToPath } from 'node:url';
import { defineConfig, lazyPlugins, type PluginOption } from 'vite-plus';
import { stripHugeiconsPureArrayAnnotations } from '../packages/viewer/vite.config';

const landingRoot = fileURLToPath(new URL('.', import.meta.url));
const viewerSource = fileURLToPath(new URL('../packages/viewer/src', import.meta.url));
const schemaSource = fileURLToPath(
  new URL('../packages/schema/src/reviewTourSchema.ts', import.meta.url),
);

export default defineConfig({
  root: landingRoot,
  // GitHub Pages serves the site from /<repo>/; local builds default to /.
  base: process.env.LANDING_BASE ?? '/',
  resolve: {
    alias: {
      '@review-tour/schema': schemaSource,
      // The viewer sources import their own modules through the `#/*` alias.
      '#': viewerSource,
    },
  },
  server: {
    port: 3100,
  },
  plugins: lazyPlugins(async () => {
    const [{ default: viteReact }, { default: tailwindcss }] = await Promise.all([
      import('@vitejs/plugin-react'),
      import('@tailwindcss/vite'),
    ]);

    return [stripHugeiconsPureArrayAnnotations(), tailwindcss(), viteReact()] as PluginOption[];
  }),
});
