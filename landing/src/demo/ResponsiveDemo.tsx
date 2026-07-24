import { useEffect, useRef, useState } from 'react';
import { useLandingI18n } from '../i18n';
import { ProductDemo } from './ProductDemo';

/* The desktop viewport rendered inside the iframe: 4px top padding + 44px title bar +
   680px workspace + 40px bottom padding for the terminal overlay. The width is the
   narrowest viewport that still renders the desktop (lg) workspace layout, so the
   scaled-down preview stays as legible as possible. */
const DEMO_STAGE_WIDTH = 1024;
const DEMO_STAGE_HEIGHT = 768;

/**
 * Renders the product demo inline on desktop viewports. Below lg the demo is rendered
 * inside a fixed-width iframe scaled down to fit, so phones still see the desktop
 * three-pane layout — media queries inside an iframe resolve against the iframe's own
 * viewport, which a CSS transform alone cannot achieve.
 */
export function ResponsiveDemo() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  return isDesktop ? <ProductDemo /> : <ScaledDemoFrame />;
}

/** Standalone page rendered when the app is loaded with the ?demo-frame query. */
export function DemoFramePage() {
  useEffect(() => {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
  }, []);

  return (
    <div className="px-3 pt-1 pb-10">
      <ProductDemo />
    </div>
  );
}

function ScaledDemoFrame() {
  const { locale, t } = useLandingI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver(() => setContainerWidth(element.clientWidth));
    observer.observe(element);
    setContainerWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);

  const scale = containerWidth > 0 ? containerWidth / DEMO_STAGE_WIDTH : 0;

  return (
    <div
      className="overflow-hidden"
      ref={containerRef}
      style={{ height: Math.round(DEMO_STAGE_HEIGHT * scale) }}
    >
      {scale > 0 ? (
        <iframe
          aria-hidden
          className="pointer-events-none origin-top-left border-0"
          loading="lazy"
          src={`${import.meta.env.BASE_URL}?demo-frame&locale=${locale}`}
          style={{
            width: DEMO_STAGE_WIDTH,
            height: DEMO_STAGE_HEIGHT,
            transform: `scale(${scale})`,
            background: 'transparent',
          }}
          tabIndex={-1}
          title={t('Review Tour desktop demo preview')}
        />
      ) : null}
    </div>
  );
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
