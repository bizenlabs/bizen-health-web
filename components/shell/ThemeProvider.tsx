"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type Theme = "light" | "dark" | "system";

export const THEME_COOKIE = "theme";

/**
 * Inline script for app/layout.tsx. Runs before paint to apply the persisted
 * theme, so there's no flash of the wrong palette on first render. Kept in
 * sync with `applyTheme` / `readCookie` below — same logic, no-dependency form.
 */
export const themeScript = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]*)/);var t=m?decodeURIComponent(m[1]):"system";var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

function readCookie(): Theme {
  const m = document.cookie.match(
    new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`),
  );
  const value = m ? decodeURIComponent(m[1]) : "";
  return value === "light" || value === "dark" ? value : "system";
}

function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // On the server we can't read the cookie, so fall back to "system"; on the
  // client we read the real value up front. This only affects the switcher's
  // own checkmark (the visible palette is set by the before-paint script), and
  // the switcher lives in a closed menu that isn't in the DOM at hydration —
  // so there's no mismatch to reconcile.
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof document === "undefined" ? "system" : readCookie(),
  );

  // Keep "system" tracking the OS while the app is open.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    applyTheme(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
