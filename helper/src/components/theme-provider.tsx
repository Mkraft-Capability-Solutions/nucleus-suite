"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  setTheme: () => undefined,
  toggleTheme: () => undefined,
});

function applyTheme(nextTheme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  // Both contracts are kept in sync: `.dark` drives the Tailwind variant and
  // `data-theme` is the design-system selector, so either can be relied on.
  root.setAttribute("data-theme", nextTheme);
  if (nextTheme === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
    root.style.colorScheme = "dark";
  } else {
    root.classList.add("light");
    root.classList.remove("dark");
    root.style.colorScheme = "light";
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const stored = localStorage.getItem("mkraft-theme") as Theme | null;
    const initialTheme = stored === "light" ? "light" : "dark";
    applyTheme(initialTheme);
    const timeout = setTimeout(() => {
      setThemeState(initialTheme);
    }, 0);
    return () => clearTimeout(timeout);
  }, []);

  const setTheme = (nextTheme: Theme) => {
    setThemeState(nextTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem("mkraft-theme", nextTheme);
    }
    applyTheme(nextTheme);
  };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
