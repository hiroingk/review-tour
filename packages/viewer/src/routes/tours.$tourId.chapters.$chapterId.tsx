import { createFileRoute } from '@tanstack/react-router';
import { TourPage } from '../client/TourPage';
import { navigateToTourTarget } from './tours.$tourId';

type TourChapterSearch = {
  file?: string;
  repo?: string;
};

export const Route = createFileRoute('/tours/$tourId/chapters/$chapterId')({
  validateSearch: (search: Record<string, unknown>): TourChapterSearch => ({
    file: typeof search.file === 'string' ? search.file : undefined,
    repo: typeof search.repo === 'string' ? search.repo : undefined,
  }),
  component: TourChapterRoute,
});

function TourChapterRoute() {
  const { chapterId, tourId } = Route.useParams();
  const { file, repo } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <TourPage
      chapterId={chapterId}
      filePath={file}
      mode="review"
      onNavigate={(target) => {
        void navigateToTourTarget({ navigate, repo, target, tourId });
      }}
      repoHash={repo}
      tourId={tourId}
    />
  );
}
