import type {} from '@tanstack/react-start';
import { createFileRoute } from '@tanstack/react-router';
import { getRequestCacheDir } from '../server/api';
import { listTours } from '../tourCache';

export const Route = createFileRoute('/api/tours')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        return Response.json(await listTours({ cacheDir: getRequestCacheDir(request) }));
      },
    },
  },
});
