// src/violations/violations.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ViolationEntity } from './violation.entity';

@Injectable()
export class ViolationsService {
  constructor(@InjectRepository(ViolationEntity) private repo: Repository<ViolationEntity>) {}


   async addGeofenceExit(input: {
    vehicleId: number | string;
    driverUserId?: number | string | null;
    meta: Record<string, any>;
  }) {
    const row = this.repo.create({
      vehicle_id: String(input.vehicleId),
      driver_user_id: input.driverUserId != null ? String(input.driverUserId) : null,
      type: 'geofence_exit',
      meta: input.meta,
    });
    return this.repo.save(row);
  }

  // ✅ جدید: ثبت تخلف خروج از مسیر
  async addOffRoute(input: {
    vehicleId: number | string;
    driverUserId?: number | string | null;
    meta: Record<string, any>;
  }) {
    const row = this.repo.create({
      vehicle_id: String(input.vehicleId),
      driver_user_id: input.driverUserId != null ? String(input.driverUserId) : null,
      type: 'off_route',
      meta: input.meta, // route_id, distance_m, threshold_m, segment_index, lat, lng, at?
    });
    return this.repo.save(row);
  }

  async findByVehicle(vehicleId: number | string, limit = 50) {
    return this.repo.find({
      where: { vehicle_id: String(vehicleId) },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  async latest(limit = 50) {
    return this.repo.find({ order: { created_at: 'DESC' }, take: limit });
  }
}

