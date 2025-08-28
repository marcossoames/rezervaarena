// CSS optimization utility for reducing unused styles
export const deferNonCriticalCSS = () => {
  // Defer loading of heavy component styles until they're needed
  const loadStylesheet = (href: string) => {
    if (!document.querySelector(`link[href="${href}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    }
  };

  // Load styles when user interacts or after delay
  const triggerStyleLoad = () => {
    // Load non-critical component styles
    import('../index.css');
  };

  // Load on first interaction or after 2 seconds
  let loaded = false;
  const loadOnce = () => {
    if (!loaded) {
      loaded = true;
      triggerStyleLoad();
    }
  };

  // Trigger on first user interaction
  ['scroll', 'mousedown', 'touchstart', 'keydown'].forEach(event => {
    window.addEventListener(event, loadOnce, { once: true, passive: true });
  });

  // Fallback: load after 2 seconds
  setTimeout(loadOnce, 2000);
};

// Initialize CSS optimization
export const initCSSOptimization = () => {
  if (typeof window !== 'undefined') {
    deferNonCriticalCSS();
  }
};