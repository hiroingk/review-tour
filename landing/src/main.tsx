import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Missing #root element');
}

// No StrictMode: the embedded viewer workspace (@pierre/trees file tree) wires an
// imperative model in effects and does not survive StrictMode's double-invocation,
// matching how the real viewer app mounts it.
createRoot(rootElement).render(<App />);
