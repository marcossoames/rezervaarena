export const openExternal = (url: string) => {
  try {
    const tryAnchorClick = () => {
      try {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.style.display = 'none';
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

    if (tryAnchorClick()) return true;

    if (window.top && window.top !== window) {
      try {
        const w = window.top.open(url, '_blank', 'noopener');
        if (w) return true;
      } catch (_) {}
    }

    try {
      const w2 = window.open(url, '_blank', 'noopener');
      if (w2) return true;
    } catch (_) {}

    return false;
  } catch (_) {
    return false;
  }
};
