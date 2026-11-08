"use client"

import { useCallback, useSyncExternalStore } from "react"

export type Theme = "light" | "dark"

function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb)
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] })
  return () => obs.disconnect()
}

const read = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light")

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, read, () => "light" as Theme)
  const toggle = useCallback(() => {
    const next: Theme = read() === "dark" ? "light" : "dark"
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem("radar:theme", next)
    } catch {
      /* private mode */
    }
  }, [])
  return [theme, toggle] as const
}
