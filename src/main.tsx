import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

async function startApp() {
  if (import.meta.env.DEV) {
    const { worker } = await import('./lib/msw.ts');
    await worker.start({ onUnhandledRequest: 'bypass' });

    // Wire MSW lifecycle events to mock toast notifications
    worker.events.on('response:mocked', ({ request }) => {
      const url = new URL(request.url);
      // Dispatch a custom event so the MockToastProvider can pick it up
      window.dispatchEvent(
        new CustomEvent('msw:mocked', { detail: { path: url.pathname } }),
      );
    });
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

startApp();
