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
const setupIOSKeyboard = async () => {
  if (Capacitor.getPlatform() !== 'ios') return;
  try {
    await Keyboard.setAccessoryBarVisible({ isVisible: false });
    // Avoid layout jumps when keyboard opens
    // Capacitor v7: ensure no auto-resize of the webview
    // @ts-ignore - union types may vary across versions
    await Keyboard.setResizeMode({ mode: 'none' });
  } catch {}
  // Re-apply on each show (iOS can recreate the accessory view)
  Keyboard.addListener?.('keyboardWillShow', async () => {
    try { await Keyboard.setAccessoryBarVisible({ isVisible: false }); } catch {}
  });
};

// Run after mount to ensure WebView is ready
setTimeout(setupIOSKeyboard, 0);


createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SecurityProvider>
      <App />
    </SecurityProvider>
  </StrictMode>
);
