// hooks/useDriverVehicleTypes.ts
import * as React from 'react';
import api from '../services/api';

export function useDriverVehicleTypes(driverIds: number[]) {
  const [types, setTypes] = React.useState<Record<number, string | null>>({});
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!driverIds?.length) { setTypes({}); return; }
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        // تلاش برای bulk
        try {
          const { data } = await api.get('/vehicles/current-by-drivers', {
            params: { driver_ids: driverIds.join(',') }
          });
          // انتظار: [{driver_id, vehicle_type_code}, ...]
          const arr = Array.isArray(data) ? data : data?.items ?? [];
          const map: Record<number, string | null> = {};
          for (const r of arr) {
            map[Number(r?.driver_id)] = r?.vehicle_type_code ?? null;
          }
          if (alive) setTypes(map);
        } catch {
          // تکی
          const entries: [number, string | null][] = [];
          for (const id of driverIds) {
            try {
              const r = await api.get('/vehicles', { params: { current_driver_user_id: id, limit: 1 } });
              const v = r?.data?.items?.[0];
              entries.push([id, v?.vehicle_type_code ?? null]);
            } catch { entries.push([id, null]); }
          }
          if (alive) setTypes(Object.fromEntries(entries));
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [driverIds?.join(',')]);

  return { typesByDriverId: types, loading };
}
