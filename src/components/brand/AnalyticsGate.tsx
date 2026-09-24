/** Load Vercel Analytics / Speed Insights only after cookie accept. */
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { useAnalyticsAllowed } from "./CookieConsent";

export function AnalyticsGate() {
  const allowed = useAnalyticsAllowed();
  if (!allowed) return null;
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
