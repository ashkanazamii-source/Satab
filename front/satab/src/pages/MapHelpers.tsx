import { useEffect } from 'react';
import { useMap, useMapEvent } from 'react-leaflet';
import L from 'leaflet';

/**
 * مرکزدهی اولیه نقشه روی مختصات و زوم
 */
export function InitView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}

/**
 * فوکوس نرم روی مختصات مشخص
 */
export function FocusOn({ target }: { target?: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo(target, Math.max(map.getZoom(), 16), { duration: 0.6 });
    }
  }, [map, target]);
  return null;
}

/**
 * لاگ کردن خطای tile و fallback در صورت شکست MapTiler
 */
export function TileErrorLogger({ onMapTilerFail }: { onMapTilerFail: () => void }) {
  useMapEvent('tileerror', (e: any) => {
    const src: string | undefined = e?.tile?.src;
    if (src?.includes('api.maptiler.com')) {
      onMapTilerFail();
    }
  });
  return null;
}

/**
 * فیت‌کردن نقشه روی تمام مارکرهای کاربران
 */
export function FitToMarkers({ users }: { users: { last_location?: { lat: number; lng: number } }[] }) {
  const map = useMap();
  useEffect(() => {
    const pts = users
      .filter((u) => u.last_location)
      .map((u) => [u.last_location!.lat, u.last_location!.lng]) as [number, number][];

    if (!pts.length) return;

    const bounds = L.latLngBounds(pts);
    if (!bounds.isValid()) return;

    if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
      map.setView(bounds.getNorthEast(), Math.min(16, 25));
    } else {
      map.fitBounds(bounds, { padding: [60, 60] });
    }
  }, [users, map]);
  return null;
}
