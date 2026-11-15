import { useCallback, useSyncExternalStore } from "react";
import {
  getTheme,
  setTheme,
  subscribeTheme,
  toggleTheme,
  type Theme,
} from "./theme";

/** Reads the interface theme and re-renders every consumer on a change. */
export function useTheme() {
  const theme = useSyncExternalStore<Theme>(
    subscribeTheme,
    getTheme,
    () => "light" as Theme,
  );
  const set = useCallback((next: Theme) => setTheme(next), []);
  const toggle = useCallback(() => toggleTheme(), []);
  return {
    theme,
    setTheme: set,
    toggleTheme: toggle,
    isDark: theme === "dark",
  };
}
