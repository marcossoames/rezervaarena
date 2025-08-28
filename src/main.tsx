import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Defer non-critical resource loading to reduce initial bundle size
const initializeNonCritical = () => {
  // Preload components on user interaction
  import('./utils/componentPreloader').then(module => 
    module.setupComponentPreloading()
  );
  
  // Initialize data prefetching
  import('./hooks/useCriticalDataPreloader.ts').then(module => 
    module.initializeCriticalDataPrefetch()
  );
};

// Initialize non-critical features after render
setTimeout(initializeNonCritical, 100);

createRoot(document.getElementById("root")!).render(<App />);
