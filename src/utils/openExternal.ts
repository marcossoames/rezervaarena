export const openExternal = (url: string) => {
  try {
    // If we're inside an iframe, try opening from the top window
    if (window.top && window.top !== window) {
      try {
        // @ts-ignore - open exists on Window
        const newWindow = window.top.open(url, '_blank', 'noopener,noreferrer');
        if (newWindow) {
          return true; // Successfully opened
        }
      } catch (_) {
        // Ignore and try local window fallback
      }
    }

    // Try opening with local window
    const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
    if (newWindow) {
      return true; // Successfully opened
    }
    
    // If popup was blocked, we won't redirect the current page
    // Just return false to indicate failure
    return false;
  } catch (_) {
    return false;
  }
};
