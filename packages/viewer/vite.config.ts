import { fileURLToPath } from 'node:url';
import { defineConfig, lazyPlugins } from 'vite-plus';

const viewerRoot = fileURLToPath(new URL('.', import.meta.url));
const schemaSource = fileURLToPath(new URL('../schema/src/reviewTourSchema.ts', import.meta.url));

export default defineConfig({
  root: viewerRoot,
  resolve: {
    alias: {
      '@review-tour/schema': schemaSource,
    },
    tsconfigPaths: true,
  },
  server: {
    port: 3000,
  },
  plugins: lazyPlugins(async () => {
    if (process.env.VITEST === 'true') {
      return [];
    }

    const [{ tanstackStart }, { default: viteReact }, { default: tailwindcss }] = await Promise.all(
      [
        import('@tanstack/react-start/plugin/vite'),
        import('@vitejs/plugin-react'),
        import('@tailwindcss/vite'),
      ],
    );

    return [stripHugeiconsPureArrayAnnotations(), tailwindcss(), tanstackStart(), viteReact()];
  }),
});

function stripHugeiconsPureArrayAnnotations() {
  return {
    name: 'review-tour:strip-hugeicons-pure-array-annotations',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (!id.includes('@hugeicons/core-free-icons')) {
        return undefined;
      }

      const next = code.replace(/\/\*#__PURE__\*\/\s+(?=\[)/g, '');
      return next === code ? undefined : { code: next, map: null };
    },
  };
}
