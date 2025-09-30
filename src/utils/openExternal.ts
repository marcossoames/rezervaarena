export const openExternal = (url: string) => {
  try {
    const tryOpen = (win: Window) => {
      // Strategy 1: open blank tab, then assign location (bypasses some sandbox blocks)
      try {
        const w = win.open('', '_blank');
        if (w) {
          try { (w as any).opener = null; } catch {}
          w.location.href = url;
          return true;
        }
      } catch (_) {}

      // Strategy 2: direct open
      try {
        const w2 = win.open(url, '_blank', 'noopener');
        if (w2) return true;
      } catch (_) {}

      return false;
    };

    if (window.top && window.top !== window) {
      if (tryOpen(window.top)) return true;
    }

    if (tryOpen(window)) return true;

    // If popup was blocked or disallowed
    return false;
  } catch (_) {
    return false;
  }
};
