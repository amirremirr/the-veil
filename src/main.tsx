import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Dev and e2e only: expose the store and a scripted player.
if (import.meta.env.DEV) void import('./ui/devtools').then((m) => m.installDevtools());
