declare global { interface Window { ALPlayableAnalytics?: { trackEvent?: (event: string) => void } } }

export function track(event: string): void {
  try {
    const trackEvent = window.ALPlayableAnalytics?.trackEvent;
    if (typeof trackEvent === 'function') {
      trackEvent.call(window.ALPlayableAnalytics, event);
      return;
    }
  } catch { /* optional host API */ }
  console.log('[Analytics]', event);
}
