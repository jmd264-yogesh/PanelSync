"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

// Suppress React 19 / Next.js warning for next-themes script injection
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const origError = console.error;
  console.error = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Encountered a script tag while rendering React component')) {
      return;
    }
    origError.apply(console, args);
  };
}

export function ThemeProvider({
  children,
  forcedTheme,
}: {
  children: React.ReactNode
  /** Locks the resolved theme for this subtree (e.g. the Recalibrate console's forced dark mode) — the ThemeToggle has no effect while a forcedTheme is set, by next-themes' design. */
  forcedTheme?: string
}) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange forcedTheme={forcedTheme}>
      {children}
    </NextThemesProvider>
  )
}

