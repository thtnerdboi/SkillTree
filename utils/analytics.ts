import type { AnalyticsEvent, AnalyticsProperties } from "./event-types";

type SentryBreadcrumb = {
  category: string;
  message: string;
  data?: AnalyticsProperties;
  level?: "debug" | "info" | "warning" | "error";
};

type AnalyticsAdapter = {
  identify: (userId: string, traits?: AnalyticsProperties) => void;
  track: (event: string, properties?: AnalyticsProperties) => void;
  reset: () => void;
};

type ErrorReporter = {
  captureException: (error: Error, context?: AnalyticsProperties) => void;
  addBreadcrumb: (breadcrumb: SentryBreadcrumb) => void;
};

let _adapter: AnalyticsAdapter | null = null;
let _reporter: ErrorReporter | null = null;
let _userId: string | null = null;
let _sessionStart: number = Date.now();

const breadcrumbBuffer: SentryBreadcrumb[] = [];
const MAX_BREADCRUMBS = 50;

function addBreadcrumb(breadcrumb: SentryBreadcrumb) {
  breadcrumbBuffer.push(breadcrumb);
  if (breadcrumbBuffer.length > MAX_BREADCRUMBS) {
    breadcrumbBuffer.shift();
  }
  _reporter?.addBreadcrumb(breadcrumb);
}

export const analytics = {
  configure(adapter: AnalyticsAdapter) {
    _adapter = adapter;
    console.log("[analytics] Adapter configured");
  },

  configureErrorReporter(reporter: ErrorReporter) {
    _reporter = reporter;
    console.log("[analytics] Error reporter configured");
  },

  identify(userId: string, traits?: AnalyticsProperties) {
    _userId = userId;
    _sessionStart = Date.now();
    console.log("[analytics] identify", { userId, ...traits });
    _adapter?.identify(userId, traits);
    addBreadcrumb({
      category: "auth",
      message: "User identified",
      data: { userId },
      level: "info",
    });
  },

  track(event: AnalyticsEvent, properties?: AnalyticsProperties) {
    const enriched: AnalyticsProperties = {
      userId: _userId ?? undefined,
      sessionMs: Date.now() - _sessionStart,
      ...properties,
    };
    console.log("[analytics] track", event, enriched);
    _adapter?.track(event, enriched);
    addBreadcrumb({
      category: "event",
      message: event,
      data: enriched,
      level: "info",
    });
  },

  captureError(error: Error, context?: AnalyticsProperties) {
    const ctx: AnalyticsProperties = {
      userId: _userId ?? undefined,
      ...context,
    };
    console.error("[analytics] captureError", error.message, ctx);
    _reporter?.captureException(error, ctx);
    addBreadcrumb({
      category: "error",
      message: error.message,
      data: ctx,
      level: "error",
    });
  },

  getBreadcrumbs(): SentryBreadcrumb[] {
    return [...breadcrumbBuffer];
  },

  reset() {
    _userId = null;
    _sessionStart = Date.now();
    breadcrumbBuffer.length = 0;
    console.log("[analytics] reset");
    _adapter?.reset();
  },
};
