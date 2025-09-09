export type LatLng = { lat: number; lng: number };

const R = 6371000; // m

export function projectMeters(lat: number, lng: number, lat0: number, lng0: number): [number, number] {
    const dLat = (lat - lat0) * Math.PI / 180;
    const dLng = (lng - lng0) * Math.PI / 180;
    const x = dLng * Math.cos((lat0 * Math.PI) / 180) * R;
    const y = dLat * R;
    return [x, y];
}

export function distancePointToSegmentMeters(p: LatLng, a: LatLng, b: LatLng): number {
    const [px, py] = projectMeters(p.lat, p.lng, a.lat, a.lng);
    const [ax, ay] = [0, 0];
    const [bx, by] = projectMeters(b.lat, b.lng, a.lat, a.lng);
    const ABx = bx - ax, ABy = by - ay;
    const APx = px - ax, APy = py - ay;
    const ab2 = ABx * ABx + ABy * ABy || 1e-12;
    let t = (APx * ABx + APy * ABy) / ab2;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * ABx, cy = ay + t * ABy;
    return Math.hypot(px - cx, py - cy);
}

export function distancePointToPolygonMeters(p: LatLng, poly: LatLng[]): number {
    if (!poly || poly.length < 2) return Infinity;
    let min = Infinity;
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        const d = distancePointToSegmentMeters(p, a, b);
        if (d < min) min = d;
    }
    return min;
}

export function pointInPolygon(p: LatLng, poly: LatLng[]): boolean {
    if (!poly || poly.length < 3) return false;
    let inside = false;
    const { lat: py, lng: px } = p;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const yi = poly[i].lat, xi = poly[i].lng;
        const yj = poly[j].lat, xj = poly[j].lng;
        const intersects =
            (yi > py) !== (yj > py) &&
            px < ((xj - xi) * (py - yi)) / ((yj - yi) || 1e-12) + xi;
        if (intersects) inside = !inside;
    }
    return inside;
}

export function insidePolygonWithTolerance(p: LatLng, poly: LatLng[], tolM: number): boolean {
    if (pointInPolygon(p, poly)) return true;
    if (tolM > 0 && Number.isFinite(tolM)) {
        return distancePointToPolygonMeters(p, poly) <= tolM;
    }
    return false;
}

export function insideCircleWithTolerance(p: LatLng, center: LatLng, radiusM: number, tolM = 0): boolean {
    const [x, y] = projectMeters(p.lat, p.lng, center.lat, center.lng);
    const dist = Math.hypot(x, y);
    return dist <= (radiusM + Math.max(0, tolM));
}
