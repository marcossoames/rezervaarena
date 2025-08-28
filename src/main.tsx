import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Defer non-critical data prefetching to reduce initial bundle size
const initializePrefetch = () => 
  import('./hooks/useCriticalDataPreloader.ts').then(module => 
    module.initializeCriticalDataPrefetch()
  );

// Initialize prefetching after critical render
setTimeout(initializePrefetch, 100);

createRoot(document.getElementById("root")!).render(<App />);
