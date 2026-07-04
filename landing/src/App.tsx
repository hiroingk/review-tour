import { ProductDemo } from './demo/ProductDemo';
import { ChaptersMock, QuestionsMock } from './mocks';
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
  return (
    <div className="min-h-screen bg-lp-canvas text-lp-fg antialiased">
      <Nav />
      <main>
        <Hero demo={<ProductDemo />} />
        <SurfacesRow />
        <section className="lp-container flex flex-col gap-4 pt-16" id="features">
          <FeaturePanel
            heading="Every pull request becomes a guided tour."
            headingMuted="Chapters order the diff by meaning instead of file path, so you review the change the way the author thought it."
            link={{ href: `${GITHUB_URL}#how-it-works`, label: 'Learn how it works' }}
            mock={<ChaptersMock />}
          />
          <FeaturePanel
            heading="Start where the risk is."
            headingMuted="Each chapter carries a risk level and concrete review questions, so high-stakes changes get your best attention first."
            link={{ href: `${GITHUB_URL}#highlights`, label: 'See what you get' }}
            mock={<QuestionsMock />}
            reverse
          />
          <InstallPanel />
        </section>
        <Statement />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
