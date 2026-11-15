/**
 * One list of lazily loaded views.
 *
 * `App.tsx` renders from it and `prefetchRoutes()` warms the same modules once
 * the first screen is idle, so a navigation to any view is a cache hit rather
 * than a first download. Keeping both readers on one map means a new view can
 * never be routable but unprefetchable.
 */
export const ROUTE_MODULES = {
  trends: () => import("../pages/Trends"),
  logbook: () => import("../pages/Logbook"),
  actions: () => import("../pages/Actions"),
  evidence: () => import("../pages/Evidence"),
  environment: () => import("../pages/Environment"),
  replay: () => import("../pages/Replay"),
  handover: () => import("../pages/Handover"),
  settings: () => import("../pages/Settings"),
  judges: () => import("../pages/Judges"),
  about: () => import("../pages/About"),
} as const;

export type RouteModuleKey = keyof typeof ROUTE_MODULES;

let started = false;

/**
 * Download the remaining view chunks after the first paint. Low priority on
 * purpose: it never competes with the screen the user is looking at, and a
 * failure is silent because every view still loads on demand.
 */
export function prefetchRoutes() {
  if (started || typeof window === "undefined") return;
  started = true;
  const run = () => {
    for (const load of Object.values(ROUTE_MODULES))
      void load().catch(() => {
        /* A view that cannot be prefetched still loads when it is opened. */
      });
  };
  const idle = (
    window as unknown as {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number },
      ) => void;
    }
  ).requestIdleCallback;
  if (idle) idle(run, { timeout: 2500 });
  else window.setTimeout(run, 1200);
}

/**
 * Ask the service worker to cache the heavy, rarely watched extras (films,
 * PDFs, posters) in the background. Previously those were downloaded during
 * install, which made the first visit pay ~5 MB before anything was offline.
 */
export function warmOfflineCache() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator))
    return;
  navigator.serviceWorker.ready
    .then((reg) => {
      const target = navigator.serviceWorker.controller ?? reg.active;
      target?.postMessage({ type: "warm" });
    })
    .catch(() => {
      /* No worker: the app still works, just without the extra cache. */
    });
}
