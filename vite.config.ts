import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite-plus';
import viewerConfig from './packages/viewer/vite.config';

const ignoredGeneratedPaths = [
  'node_modules/**',
  '**/node_modules/**',
  '**/.pnpm/**',
  '**/dist/**',
  '**/routeTree.gen.ts',
];
const viewerAlias =
  typeof viewerConfig.resolve?.alias === 'object' && !Array.isArray(viewerConfig.resolve.alias)
    ? viewerConfig.resolve.alias
    : {};

export default defineConfig({
  ...viewerConfig,
  resolve: {
    ...viewerConfig.resolve,
    alias: Object.assign({}, viewerAlias, {
      '@review-tour/viewer': fileURLToPath(
        new URL('./packages/viewer/src/index.ts', import.meta.url),
      ),
    }),
  },
  fmt: {
    ignorePatterns: ignoredGeneratedPaths,
    singleQuote: true,
    semi: true,
    sortPackageJson: true,
  },
  lint: {
    ignorePatterns: ignoredGeneratedPaths,
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    rules: {
      'vite-plus/prefer-vite-plus-imports': 'error',
    },
  },
  test: {
    include: [
      '../cli/test/**/*.test.{js,ts,tsx}',
      '../schema/test/**/*.test.{js,ts,tsx}',
      'test/**/*.test.{js,ts,tsx}',
    ],
    environment: 'node',
  },
});
