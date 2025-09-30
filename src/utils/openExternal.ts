export const openExternal = (url: string) => {
  try {
    const tryAnchorClick = () => {
      try {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.style.display = 'none';
        // Some browsers honor this even with rel set
        // @ts-ignore
        a.referrerPolicy = 'no-referrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return true;
      } catch (_) {
        return false;
      }
    };

    // Try programmatic anchor click first (best for sandboxed iframes)
    if (tryAnchorClick()) return true;

    // Fallback 1: Direct open from top if possible
    if (window.top && window.top !== window) {
      try {
        const w = window.top.open(url, '_blank', 'noopener');
        if (w) return true;
      } catch (_) {}
    }

    // Fallback 2: Direct open from current window
    try {
      const w2 = window.open(url, '_blank', 'noopener');
      if (w2) return true;
    } catch (_) {}

    return false;
  } catch (_) {
    return false;
  }
};
