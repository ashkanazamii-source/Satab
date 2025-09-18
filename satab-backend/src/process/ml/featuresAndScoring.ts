// ml/featuresAndScoring.ts
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import { point } from "@turf/helpers";
import bearing from "@turf/bearing";
import { Feature, LineString, Polygon } from "geojson";

type MatchedPoint = { lat: number; lon: number; heading?: number };
type Score = { onRouteProb: number; distToCorridorM: number; bearingDeltaDeg?: number; insideCorridor: boolean };

export function computeFeaturesAndScore(
  matched: MatchedPoint,
  routeLine: Feature<LineString>,
  corridor: Feature<Polygon>
): Score {
  const pt = point([matched.lon, matched.lat]);

  // داخل کریدور هست؟
  const inside = booleanPointInPolygon(pt, corridor);

  // نزدیک‌ترین نقطه مسیر و فاصله
  const np = nearestPointOnLine(routeLine, pt);
  const distToCorridorM = np.properties!.dist! * 1000; // اگر units کیلومتر بوده

  // اختلاف جهت تقریبی: بین heading فعلی و جهت خط در نقطه نزدیک
  let bearingDelta: number | undefined;
  if (typeof matched.heading === "number") {
    // خط محلی: نقطه نزدیک و یک نقطه کمی جلوتر روی خط (ساده)
    bearingDelta = Math.abs(matched.heading - (np.properties!.bearing ?? matched.heading));
    if (bearingDelta > 180) bearingDelta = 360 - bearingDelta;
  }

  // امتیاز ساده: داخل کریدور + جهت خوب → احتمال بالا
  let p = 0.5;
  if (inside) p += 0.3;
  if (distToCorridorM < 25) p += 0.15;
  if (bearingDelta !== undefined && bearingDelta < 25) p += 0.15;
  p = Math.max(0, Math.min(1, p));

  return { onRouteProb: p, distToCorridorM, bearingDeltaDeg: bearingDelta, insideCorridor: inside };
}
