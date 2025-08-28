// Component preloader to warm up lazy components on user interaction
import { preloadComponent } from "./lazyImports";

// Preload critical below-the-fold components
export const preloadCriticalComponents = () => {
  // Preload search section when user scrolls or interacts
  preloadComponent(() => import("@/components/OptimizedSearchSection"));
  
  // Preload sports section for quick access
  preloadComponent(() => import("@/components/ResponsiveSportsSection"));
};

// Preload on user interaction (hover, scroll, etc.)
export const setupComponentPreloading = () => {
  let preloaded = false;
  
  const triggerPreload = () => {
    if (!preloaded) {
      preloaded = true;
      preloadCriticalComponents();
    }
  };

  // Preload on first scroll
  window.addEventListener('scroll', triggerPreload, { once: true, passive: true });
  
  // Preload on first user interaction
  ['mousedown', 'touchstart', 'keydown'].forEach(event => {
    window.addEventListener(event, triggerPreload, { once: true, passive: true });
  });
  
  // Fallback: preload after 2 seconds if no interaction
  setTimeout(triggerPreload, 2000);
};