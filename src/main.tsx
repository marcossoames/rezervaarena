import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { SecurityProvider } from './components/SecurityProvider'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'

// Defer non-critical data prefetching to reduce initial bundle size
const initializePrefetch = () => 
  import('./hooks/useCriticalDataPreloader.ts').then(module => 
    module.initializeCriticalDataPrefetch()
  );

// Initialize prefetching after critical render
setTimeout(initializePrefetch, 100);

// iOS: hide the keyboard accessory bar (arrows/check) in Capacitor app
try {
  if (Capacitor.getPlatform() === 'ios') {
    Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {});
  }
} catch {}


createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SecurityProvider>
      <App />
    </SecurityProvider>
  </StrictMode>
);
