import type {} from '@tanstack/react-start';
import { createFileRoute } from '@tanstack/react-router';
import { getRequestCacheDir, jsonError } from '../server/api';
import { getSafeErrorMessage, readTourFromCache } from '../tourCache';

export const Route = createFileRoute('/api/tours/$tourId')({
  server: {
    handlers: {
      GET: async ({ params, request }: { params: { tourId: string }; request: Request }) => {
        const requestUrl = new URL(request.url);
        const repoHash = requestUrl.searchParams.get('repo');
        if (!repoHash) {
          return jsonError('Missing repo query', 400);
        }

        try {
          return Response.json(
            await readTourFromCache({
              cacheDir: getRequestCacheDir(request),
              repoHash,
              tourId: params.tourId,
            }),
          );
        } catch (error) {
          return jsonError(getSafeErrorMessage(error), 404);
        }
      },
    },
  },
});
