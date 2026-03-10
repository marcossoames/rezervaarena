import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { SecurityProvider } from './components/SecurityProvider'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'

const initializePrefetch = () => 
  import('./hooks/useCriticalDataPreloader.ts').then(module => 
    module.initializeCriticalDataPrefetch()
  );

setTimeout(initializePrefetch, 100);

try {
  if (Capacitor.isNativePlatform()) {
    document.body.classList.add('native-platform');
    Keyboard.setAccessoryBarVisible({ isVisible: false });
    // @ts-ignore
    Keyboard.setResizeMode({ mode: 'none' });
    Keyboard.addListener('keyboardWillShow', () => {
      Keyboard.setAccessoryBarVisible({ isVisible: false });
    });
  }
} catch (e) {
  // web fallback
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SecurityProvider>
      <App />
    </SecurityProvider>
  </StrictMode>
);