import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ScrollToTop = () => {
  const { pathname, hash, key } = useLocation();

  useEffect(() => {
    // Don't scroll if there's a hash (anchor link)
    if (hash) {
      return;
    }

    // Scroll to top instantly on route change
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant' as ScrollBehavior
    });
  }, [pathname, hash, key]);

  return null;
};

export default ScrollToTop;
