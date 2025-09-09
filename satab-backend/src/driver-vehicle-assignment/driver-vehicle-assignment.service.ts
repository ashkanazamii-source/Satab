import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { DriverVehicleAssignment } from './driver-vehicle-assignment.entity';
import { Users } from '../users/users.entity';
import { Vehicle } from '../vehicles/vehicle.entity';

@Injectable()
export class DriverVehicleAssignmentService {
  constructor(
    @InjectRepository(DriverVehicleAssignment)
    private readonly repo: Repository<DriverVehicleAssignment>,
    @InjectRepository(Vehicle)
    private readonly vehRepo: Repository<Vehicle>,
  ) {}

  async startAssignment(driverId: number, vehicleId: number) {
    await this.repo.update({ driver_id: driverId, ended_at: IsNull() }, { ended_at: new Date() });
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
}



