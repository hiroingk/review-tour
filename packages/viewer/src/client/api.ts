import type { ReviewTour } from 'review-tour/schema';
import type { ListedTour } from '../tourCache';

export function fetchTours() {
  return fetchJson<ListedTour[]>('/api/tours');
}

export function fetchTour(input: { repoHash: string; tourId: string }) {
  const url = `/api/tours/${encodeURIComponent(input.tourId)}?repo=${encodeURIComponent(
    input.repoHash,
  )}`;
  return fetchJson<ReviewTour>(url);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

async function readErrorMessage(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (body?.error) {
      return body.error;
    }
  }

  const text = await response.text().catch(() => '');
  return text || `Request failed with ${response.status}.`;
}
