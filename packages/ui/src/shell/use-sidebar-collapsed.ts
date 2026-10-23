"use client";

import { useSyncExternalStore } from "react";

const KEY = "corex.sidebar.collapsed";
const listeners = new Set<() => void>();
// Fallback when localStorage is unavailable (private mode, blocked storage).
let memoryValue = false;

function read(): boolean {
  try {
    const stored = window.localStorage.getItem(KEY);
    return stored === null ? memoryValue : stored === "1";
  } catch {
    return memoryValue;
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Persists the per-device sidebar preference. Server render assumes expanded. */
export function useSidebarCollapsed(): [collapsed: boolean, toggle: () => void] {
  const collapsed = useSyncExternalStore(subscribe, read, () => false);
  const toggle = () => {
    memoryValue = !read();
    try {
      window.localStorage.setItem(KEY, memoryValue ? "1" : "0");
    } catch {
      // Keep the in-memory value; the preference is only a convenience.
    }
    listeners.forEach((listener) => listener());
  };
  return [collapsed, toggle];
}
