import type { getRouter } from './router';

declare module '@tanstack/react-start' {
  interface Register {
    ssr: true;
    router: Awaited<ReturnType<typeof getRouter>>;
  }
}
