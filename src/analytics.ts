declare global { interface Window { ALPlayableAnalytics?: { trackEvent?: (event: string) => void } } }

export function track(event: string): void {
  try { window.ALPlayableAnalytics?.trackEvent?.(event); } catch { /* optional host API */ }
}
