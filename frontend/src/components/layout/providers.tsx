"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ToastProvider } from "@/components/ui/toast";
import { ApiError } from "@/services/api";

type Theme = "light" | "dark";
const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void } | null>(null);

export const THEME_KEY = "sas3d-theme";

/** Runs before first paint so that light-mode users never see a flash of the default dark theme. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  useEffect(() => {
    // The attribute is set by THEME_SCRIPT before hydration; this only syncs React state to it.

    setThemeState(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);
  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage can be blocked; the theme still applies for this page view.
    }
  }, []);
  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
            retry: (count, error) =>
              !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
              count < 2,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>{children}</ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
