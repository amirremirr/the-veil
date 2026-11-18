import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './index.css';
// V5 N2 (D-211): Play's studio fonts, bundled (no font CDN); the files load only where Play uses them.
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Dev and e2e only: expose the store and a scripted player.
if (import.meta.env.DEV) void import('./ui/devtools').then((m) => m.installDevtools());
