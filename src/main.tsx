import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initializeCriticalDataPrefetch } from './hooks/useCriticalDataPreloader.ts'

// Initialize critical data prefetching to reduce request chain delays
initializeCriticalDataPrefetch();

createRoot(document.getElementById("root")!).render(<App />);
