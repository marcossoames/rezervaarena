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

// iOS: hide keyboard accessory bar and prevent header jump
try {
  if (Capacitor.isNativePlatform()) {
    // Add native platform class for platform-specific styling
    document.body.classList.add('native-platform');
    
    Keyboard.setAccessoryBarVisible({ isVisible: false });
    // Prevent viewport resizing that can push fixed header down
    // @ts-ignore - mode type available on native
    Keyboard.setResizeMode({ mode: 'none' });
    Keyboard.addListener('keyboardWillShow', () => {
      Keyboard.setAccessoryBarVisible({ isVisible: false });
    });
  }
} catch (e) {
  // no-op on web
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SecurityProvider>
      <App />
    </SecurityProvider>
  </StrictMode>
);
