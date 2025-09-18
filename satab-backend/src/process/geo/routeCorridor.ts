// geo/routeCorridor.ts
import axios from "axios";
import { lineString } from "@turf/helpers";
import buffer from "@turf/buffer";

// ورودی: Waypoints با ترتیب رانندگی (lat, lon). توجه: GeoJSON = [lon, lat]
export async function buildPlannedRouteAndCorridor(
  waypoints: Array<{ lat: number; lon: number }>,
  corridorWidthMeters = 40
) {
  // 1) درخواست مسیر از Valhalla (یا OSRM/Mapbox). این نمونه Valhalla است:
  const valhallaUrl = process.env.VALHALLA_URL ?? "http://localhost:8002/route";
  const res = await axios.post(valhallaUrl, {
    locations: waypoints.map(w => ({ lat: w.lat, lon: w.lon })),
    costing: "auto",
    directions_options: { units: "kilometers" }
  });

  // 2) Polyline مسیر را استخراج کن (به GeoJSON LineString تبدیل کنیم)
  const shape = res.data?.trip?.legs?.flatMap((leg: any) => leg.shape) ?? [];
  // اگر shape بصورت encoded polyline برگشت، باید decode کنی؛
  // در خیلی از نصب‌های Valhalla، خروجی GeoJSON هم می‌شه گرفت. برای سادگی فرض می‌گیریم coords داریم:
  const coords: [number, number][] = shape.map((p: any) => [p.lon, p.lat]);

  const routeLine = lineString(coords);             // GeoJSON LineString
  const corridor = buffer(routeLine, corridorWidthMeters, { units: "meters" }); // Polygon

  return { routeLine, corridor }; // هر دو GeoJSON هستن
}
