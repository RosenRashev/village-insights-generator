import { useEffect, useState } from "react";

/** Следи медиазаявка (напр. "(min-width: 1280px)"). На сървъра и при първо рисуване е `false`. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);

  return matches;
}
