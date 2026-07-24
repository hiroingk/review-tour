import { createRoot } from 'react-dom/client';
import { App } from './App';
import { DemoFramePage } from './demo/ResponsiveDemo';
import { LandingLocaleProvider } from './i18n';
import './styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Missing #root element');
}

// ?demo-frame serves the bare demo for the scaled-down iframe preview on small screens.
const isDemoFrame = new URLSearchParams(window.location.search).has('demo-frame');

// No StrictMode: the embedded viewer workspace (@pierre/trees file tree) wires an
// imperative model in effects and does not survive StrictMode's double-invocation,
// matching how the real viewer app mounts it.
createRoot(rootElement).render(
  <LandingLocaleProvider>{isDemoFrame ? <DemoFramePage /> : <App />}</LandingLocaleProvider>,
);
