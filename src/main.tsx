import { createRoot } from 'react-dom/client'
import App from './App.tsx'
// Critical CSS is inlined in index.html
// Non-critical CSS will be loaded asynchronously

// Defer non-critical resource loading to reduce initial bundle size
const initializeNonCritical = () => {
  // Initialize CSS optimization
  import('./utils/cssOptimization').then(module => 
    module.initCSSOptimization()
  );

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
