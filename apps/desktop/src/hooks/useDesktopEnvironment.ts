import { useEffect, useState } from 'react';

import { isTauriRuntime, listSystemFonts } from '../lib/desktop-runtime';

interface UseDesktopEnvironmentParams {
  mediaQuery: string;
  fallbackFonts: string[];
}

export function useDesktopEnvironment({ mediaQuery, fallbackFonts }: UseDesktopEnvironmentParams) {
  const [isXlLayout, setIsXlLayout] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(mediaQuery).matches;
  });
  const [availableFonts, setAvailableFonts] = useState<string[]>(fallbackFonts);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const media = window.matchMedia(mediaQuery);
    const handleChange = (event: MediaQueryListEvent) => {
      setIsXlLayout(event.matches);
    };

    setIsXlLayout(media.matches);
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [mediaQuery]);

  useEffect(() => {
    if (!isTauriRuntime()) {
      setAvailableFonts(fallbackFonts);
      return;
    }

    listSystemFonts()
      .then((fonts) => {
        if (fonts.length > 0) {
          setAvailableFonts(fonts);
          return;
        }
        setAvailableFonts(fallbackFonts);
      })
      .catch(() => {
        setAvailableFonts(fallbackFonts);
      });
  }, [fallbackFonts]);

  return { isXlLayout, availableFonts };
}
