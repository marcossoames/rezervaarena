import { useEffect } from "react";

export const useBodyClass = (className: string) => {
  useEffect(() => {
    if (!className) return;
    const body = document.body;
    body.classList.add(className);
    return () => {
      body.classList.remove(className);
    };
  }, [className]);
};
