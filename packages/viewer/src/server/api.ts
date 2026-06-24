export const REVIEW_TOUR_CACHE_DIR_HEADER = 'x-review-tour-cache-dir';

export function getRequestCacheDir(request: Request) {
  return request.headers.get(REVIEW_TOUR_CACHE_DIR_HEADER) ?? undefined;
}

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}
