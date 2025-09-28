export const openExternal = (url: string) => {
  try {
    // If we're inside an iframe, try opening from the top window
    if (window.top && window.top !== window) {
      try {
        // @ts-ignore - open exists on Window
        window.top.open(url, '_blank', 'noopener,noreferrer');
        return;
      } catch (_) {
        // Ignore and try local window fallback
      }
    }

    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) {
      // Popup blocked: last-resort fallback
      window.location.href = url;
    }
  } catch (_) {
    // Absolute fallback
    window.location.href = url;
  }
};
