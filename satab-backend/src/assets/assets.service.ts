// src/assets/assets.service.ts
import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Device } from '../entities/device.entity';

@Injectable()
export class AssetsService {
  constructor(
    private readonly ds: DataSource,
    @InjectRepository(Vehicle) private readonly vRepo: Repository<Vehicle>,
    @InjectRepository(Device) private readonly dRepo: Repository<Device>,
  ) {}

  async createVehicle(currentUser: { id:number; role_level:number }, dto: Partial<Vehicle>) {
    if (!dto.plate_no || !dto.vehicle_type_code || !dto.owner_user_id)
      throw new BadRequestException('plate_no, vehicle_type_code, owner_user_id لازم است');

    // (اختیاری) کنترل سهمیه و مجوز ایجاد در اینجا
    return this.vRepo.save(this.vRepo.create(dto));
  }

  async createDevice(currentUser: { id:number; role_level:number }, dto: Partial<Device>) {
    if (!dto.serial_no || !dto.device_type_code || !dto.owner_user_id)
      throw new BadRequestException('serial_no, device_type_code, owner_user_id لازم است');

    return this.dRepo.save(this.dRepo.create(dto));
  }

  /**
   * همه‌ی user_id های زیرمجموعه‌ی یک کاربر (خودش + فرزندان همه‌سطح‌ها)
   */
  async getSubtreeUserIds(rootUserId: number): Promise<number[]> {
    const rows = await this.ds.query(`
      WITH RECURSIVE sub AS (
        SELECT id, parent_id FROM users WHERE id = $1
        UNION ALL
        SELECT u.id, u.parent_id
        FROM users u
        INNER JOIN sub s ON u.parent_id = s.id
      )
      SELECT id FROM sub;
    `, [rootUserId]);
    return rows.map((r: any) => Number(r.id));
  }

  async listVehiclesInMySubtree(currentUserId: number) {
    const ids = await this.getSubtreeUserIds(currentUserId);
    if (ids.length === 0) return [];
    return this.vRepo.createQueryBuilder('v')
      .where('v.owner_user_id IN (:...ids)', { ids })
      .orderBy('v.id','DESC')
      .getMany();
  }

  async listDevicesInMySubtree(currentUserId: number) {
    const ids = await this.getSubtreeUserIds(currentUserId);
    if (ids.length === 0) return [];
    return this.dRepo.createQueryBuilder('d')
      .where('d.owner_user_id IN (:...ids)', { ids })
      .orderBy('d.id','DESC')
      .getMany();
  }
}
