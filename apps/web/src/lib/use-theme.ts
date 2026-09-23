"use client";

import { create } from "zustand";
import { THEME_STORAGE_KEY } from "@/lib/theme-storage";

export type ThemeMode = "light" | "dark";

function applyTheme(theme: ThemeMode) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function readStoredTheme(): ThemeMode {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "dark" || stored === "light") {
      return stored;
    }
  } catch {
    // Private mode can block localStorage. Stay on light paper.
  }
  return "light";
}

type ThemeState = {
  theme: ThemeMode;
  ready: boolean;
  hydrate: () => void;
  setTheme: (theme: ThemeMode) => void;
  toggle: () => void;
};

export const useTheme = create<ThemeState>((set, get) => ({
  theme: "light",
  ready: false,
  hydrate: () => {
    const theme = readStoredTheme();
    applyTheme(theme);
    set({ theme, ready: true });
  },
  setTheme: (theme) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Preference still applies for this tab.
    }
    applyTheme(theme);
    set({ theme });
  },
  toggle: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    get().setTheme(next);
  },
}));
