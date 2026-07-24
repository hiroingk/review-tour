import { ResponsiveDemo } from './demo/ResponsiveDemo';
import { useLandingI18n } from './i18n';
import { ChaptersMock, CodeJumpMock, QuestionsMock } from './mocks';
import {
  FeaturePanel,
  FinalCta,
  Footer,
  GITHUB_URL,
  Hero,
  InstallPanel,
  Nav,
  Statement,
  SurfacesRow,
} from './sections';

export function App() {
  const { t } = useLandingI18n();
  return (
    <div className="min-h-screen bg-lp-canvas text-lp-fg antialiased">
      <Nav />
      <main>
        <Hero demo={<ResponsiveDemo />} />
        <SurfacesRow />
        <section className="lp-container flex flex-col gap-4 scroll-mt-24 pt-16" id="features">
          <FeaturePanel
            heading={t('Every pull request becomes a guided tour.')}
            headingMuted={t(
              'Chapters order the diff by meaning instead of file path, so you review the change the way the author thought it.',
            )}
            link={{ href: `${GITHUB_URL}#how-it-works`, label: t('Learn how it works') }}
            mock={<ChaptersMock />}
          />
          <FeaturePanel
            heading={t('Start where the risk is.')}
            headingMuted={t(
              'Each chapter carries a risk level and concrete review questions, so high-stakes changes get your best attention first.',
            )}
            link={{ href: `${GITHUB_URL}#highlights`, label: t('See what you get') }}
            mock={<QuestionsMock />}
            reverse
          />
          <FeaturePanel
            heading={t('Jump from a symbol to its definition.')}
            headingMuted={t(
              'Click a symbol in the diff to follow it across files and chapters without losing your review context.',
            )}
            link={{ href: `${GITHUB_URL}#highlights`, label: t('Explore the viewer') }}
            mock={<CodeJumpMock />}
          />
        </section>
        <InstallPanel />
        <Statement />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
