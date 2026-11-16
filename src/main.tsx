import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { FirebaseErrorBoundary } from './firebase.tsx';
import './index.css';

// Register PWA service worker for offline-first schedules & assets
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <FirebaseErrorBoundary>
    <App />
  </FirebaseErrorBoundary>
);
