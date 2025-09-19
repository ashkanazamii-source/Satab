// src/driver-vehicle-assignment/driver-vehicle-assignment.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { DriverVehicleAssignment } from './driver-vehicle-assignment.entity';

@Injectable()
export class DriverVehicleAssignmentService {
  constructor(
    @InjectRepository(DriverVehicleAssignment)
    private readonly repo: Repository<DriverVehicleAssignment>,
  ) {}

  async startAssignment(driverId: number, vehicleId: number) {
    // 1) انتساب فعال قبلی همین راننده را ببند
    await this.repo.update({ driver_id: driverId, ended_at: IsNull() }, { ended_at: new Date() });
    // 2) هر انتساب فعال دیگری روی همین خودرو را ببند (برای جلوگیری از دو راننده روی یک خودرو)
    await this.repo.update({ vehicle_id: vehicleId, ended_at: IsNull() }, { ended_at: new Date() });

    // 3) انتساب جدید
    const assign = this.repo.create({
      driver_id: driverId,
      vehicle_id: vehicleId,
      started_at: new Date(),
    });
    return this.repo.save(assign);
  }

  async endAssignment(driverId: number) {
    const active = await this.repo.findOne({ where: { driver_id: driverId, ended_at: IsNull() } });
    if (!active) return null;
    active.ended_at = new Date();
    return this.repo.save(active);
  }

  async getCurrentAssignment(driverId: number) {
    const assign = await this.repo.findOne({
      where: { driver_id: driverId, ended_at: IsNull() },
      relations: ['vehicle'],
    });
    return assign || null;
  }

  async history(driverId: number) {
    const list = await this.repo.find({
      where: { driver_id: driverId },
      order: { started_at: 'DESC' },
      relations: ['vehicle'],
    });
    return list;
  }

  // کمکی برای ثبت تخلف/پوزیشن: رانندهٔ فعالِ یک خودرو
  async getActiveDriverByVehicle(vehicleId: number): Promise<number | null> {
    const row = await this.repo.findOne({
      where: { vehicle_id: vehicleId, ended_at: IsNull() },
      select: ['driver_id'],
      order: { started_at: 'DESC' },
    });
    return row?.driver_id ?? null;
  }
}
