// src/analytics/dto/hierarchy-analytics.dto.ts
export interface NodeAnalytics {
  id: number;
  full_name: string;
  role_level: number;
  summary: {
    drivers: number;
    totalDistanceKm: number;
    engineHours: number;
    totalViolations: number;
  };
  children: NodeAnalytics[];
}
