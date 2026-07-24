import { useEffect, useMemo, useState } from 'react';
import GitBranchIcon from '@hugeicons/core-free-icons/GitBranchIcon';
import { Link } from '@tanstack/react-router';
import { Skeleton } from '#/components/ui/skeleton';
import type { ListedTour } from '../tourCache';
import { fetchTours } from './api';
import { LanguageControl, type Translator, useI18n } from './i18n';
import { ThemeModeControl } from './theme';
import { AppIcon } from './ui';

type ToursState =
  | { status: 'loading' }
  | { status: 'ready'; tours: ListedTour[] }
  | { status: 'error'; message: string };

export function TourIndex() {
  const { locale, t } = useI18n();
  const [state, setState] = useState<ToursState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetchTours()
      .then((tours) => {
        if (!cancelled) setState({ status: 'ready', tours });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Failed to load tours.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const repositoryGroups = useMemo(
    () => (state.status === 'ready' ? groupToursByRepository(state.tours) : []),
    [state],
  );

  return (
    <main className="min-h-screen bg-canvas px-6 py-10 text-fg max-sm:px-4">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-end justify-between gap-6 pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-fg-muted">
              Review Tour
            </p>
            <h1 className="mt-2 text-3xl font-bold leading-tight">{t('Generated tours')}</h1>
          </div>
          <div className="flex items-center gap-2">
            <LanguageControl />
            <ThemeModeControl />
          </div>
        </header>

        {state.status === 'loading' ? (
          <TourIndexSkeleton />
        ) : state.status === 'error' ? (
          <p className="surface-panel mt-8 rounded-[8px] bg-error-soft p-4 text-sm leading-[1.55] text-error">
            {localizeToursError(state.message, t)}
          </p>
        ) : repositoryGroups.length === 0 ? (
          <p className="surface mt-8 rounded-[8px] bg-panel px-5 py-4 text-sm text-fg-muted">
            {t('No branches with review tour artifacts found.')}
          </p>
        ) : (
          <div className="mt-7 grid gap-5">
            {repositoryGroups.map((group) => (
              <section
                className="surface-panel overflow-hidden rounded-[8px] bg-raised"
                key={group.repoHash}
              >
                <header className="grid min-h-[62px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-hairline px-5 py-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold leading-6">
                      {group.repositoryName}
                    </h2>
                    <p className="mt-0.5 font-mono text-xs text-fg-faint">{group.repoHash}</p>
                  </div>
                  <span className="mono-tabular text-xs text-fg-muted">
                    {t(group.branches.length === 1 ? '{count} branch' : '{count} branches', {
                      count: group.branches.length,
                    })}
                  </span>
                </header>
                <div>
                  {group.branches.map((tour) => (
                    <Link
                      className="focus-ring grid min-h-16 grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 border-b border-hairline px-5 py-3 text-fg no-underline transition-[background-color,box-shadow,color] duration-150 ease-out last:border-b-0 hover:bg-hover"
                      key={`${tour.repoHash}:${tour.branchName}`}
                      params={{ tourId: tour.tourId }}
                      search={{ repo: tour.repoHash }}
                      to="/tours/$tourId"
                    >
                      <AppIcon className="text-fg-muted" icon={GitBranchIcon} size={16} />
                      <span className="min-w-0">
                        <strong className="block truncate font-mono text-sm font-semibold">
                          {tour.branchName ?? t('unknown')}
                        </strong>
                        <span className="mt-0.5 block truncate text-xs text-fg-muted">
                          {t('Latest artifact')}
                        </span>
                      </span>
                      <time className="mono-tabular text-right text-xs text-fg-faint">
                        {formatTourDate(tour.createdAt, locale)}
                      </time>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function TourIndexSkeleton() {
  return (
    <div aria-busy="true" className="mt-7 grid gap-5">
      {Array.from({ length: 3 }, (_, groupIndex) => (
        <section className="surface-panel overflow-hidden rounded-[8px] bg-raised" key={groupIndex}>
          <header className="grid min-h-[62px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-hairline px-5 py-3">
            <div className="min-w-0">
              <Skeleton className="h-5 w-[min(220px,72%)] rounded-[5px]" />
              <Skeleton className="mt-2 h-3 w-[min(320px,54%)] rounded-[4px]" />
            </div>
            <Skeleton className="h-4 w-16 rounded-[4px]" />
          </header>
          <div>
            {Array.from({ length: groupIndex === 0 ? 3 : 2 }, (_, rowIndex) => (
              <div
                className="grid min-h-16 grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 border-b border-hairline px-5 py-3 last:border-b-0"
                key={rowIndex}
              >
                <Skeleton className="size-4 rounded-[4px]" />
                <span className="min-w-0">
                  <Skeleton className="h-4 w-[min(260px,70%)] rounded-[4px]" />
                  <Skeleton className="mt-2 h-3 w-[min(140px,42%)] rounded-[4px]" />
                </span>
                <Skeleton className="h-4 w-20 rounded-[4px]" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

type RepositoryTourGroup = {
  branches: ListedTour[];
  repoHash: string;
  repositoryName: string;
};

function groupToursByRepository(tours: ListedTour[]): RepositoryTourGroup[] {
  const groups = new Map<string, RepositoryTourGroup>();

  for (const tour of tours) {
    const group = groups.get(tour.repoHash) ?? {
      branches: [],
      repoHash: tour.repoHash,
      repositoryName: tour.repositoryName ?? tour.repoHash,
    };
    group.branches.push(tour);
    groups.set(tour.repoHash, group);
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      branches: group.branches.sort((a, b) =>
        (a.branchName ?? '').localeCompare(b.branchName ?? ''),
      ),
    }))
    .sort((a, b) => a.repositoryName.localeCompare(b.repositoryName));
}

function formatTourDate(value: string | undefined, locale: 'en' | 'ja') {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(date);
}

function localizeToursError(message: string, t: Translator) {
  return message === 'Failed to load tours.' ? t('Failed to load tours.') : message;
}
