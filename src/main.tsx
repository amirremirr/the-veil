import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './index.css';

// UI V4 (V5): ?styles=1 shows the three style directions (a preview page, loaded only on that address).
const styles = (() => {
  try {
    return new URL(window.location.href).searchParams.get('styles') === '1';
  } catch {
    return false;
  }
})();
const StylePreview = lazy(() => import('./ui/styles/StylePreview').then((m) => ({ default: m.StylePreview })));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {styles ? (
      <Suspense fallback={null}>
        <StylePreview />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);

// Dev and e2e only: expose the store and a scripted player.
if (import.meta.env.DEV) void import('./ui/devtools').then((m) => m.installDevtools());
