import { Outlet, createFileRoute, useLocation } from '@tanstack/react-router';
import { TourPage, type TourNavigationTarget } from '../client/TourPage';

type TourSearch = {
  repo?: string;
};

export const Route = createFileRoute('/tours/$tourId')({
  validateSearch: (search: Record<string, unknown>): TourSearch => ({
    repo: typeof search.repo === 'string' ? search.repo : undefined,
  }),
  component: TourRoute,
});

function TourRoute() {
  const { tourId } = Route.useParams();
  const { repo } = Route.useSearch();
  const navigate = Route.useNavigate();
  const pathname = useLocation({ select: (location: { pathname: string }) => location.pathname });

  if (pathname.includes('/chapters/')) {
    return <Outlet />;
  }

  return (
    <TourPage
      mode="overview"
      onNavigate={(target) => {
        void navigateToTourTarget({ navigate, repo, target, tourId });
      }}
      repoHash={repo}
      tourId={tourId}
    />
  );
}

type TourNavigate = ReturnType<typeof Route.useNavigate>;

export function getTourRouteSearch(repo?: string, filePath?: string) {
  return {
    ...(repo ? { repo } : {}),
    ...(filePath ? { file: filePath } : {}),
  };
}

export function navigateToTourTarget({
  navigate,
  repo,
  target,
  tourId,
}: {
  navigate: TourNavigate;
  repo?: string;
  target: TourNavigationTarget;
  tourId: string;
}) {
  if (target.mode === 'overview') {
    return navigate({
      params: { tourId },
      search: getTourRouteSearch(repo),
      to: '/tours/$tourId',
    });
  }

  return navigate({
    params: { chapterId: target.chapterId, tourId },
    search: getTourRouteSearch(repo, target.filePath),
    to: '/tours/$tourId/chapters/$chapterId',
  });
}
