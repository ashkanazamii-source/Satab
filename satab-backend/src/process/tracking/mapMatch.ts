// tracking/mapMatch.ts
import axios from "axios";

type Ping = { driver_id: string; lat: number; lon: number; speed?: number; heading?: number; ts: number };

// یک فیلتر نرم ساده (EMA). بعداً Kalman جایگزین کن.
export function smoothPing(prev: Ping | null, curr: Ping, alpha = 0.4): Ping {
  if (!prev) return curr;
  return {
    ...curr,
    lat: prev.lat + alpha * (curr.lat - prev.lat),
    lon: prev.lon + alpha * (curr.lon - prev.lon),
    speed: curr.speed ?? prev.speed,
    heading: curr.heading ?? prev.heading,
  };
}

// Map-Matching با Valhalla trace_attributes/trace_route
export async function mapMatchPings(pings: Ping[]) {
  const url = process.env.VALHALLA_MATCH_URL ?? "http://localhost:8002/trace_route";
  const res = await axios.post(url, {
    shape: pings.map(p => ({ lat: p.lat, lon: p.lon, time: Math.floor(p.ts / 1000) })),
    costing: "auto",
    directions_options: { units: "kilometers" },
    // optionally: "gps_accuracy": 20
  });
  // خروجی، نقاط snap شده و جزئیات edgeها:
  return res.data; // شامل shape matched + edge_ids + confidence
}
