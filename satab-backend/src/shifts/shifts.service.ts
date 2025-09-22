// src/shifts/shifts.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Shift, ShiftStatus } from './shift.entity'; // ← همینو بیار، enum محلی نساز
import { CreateShiftDto } from '../dto/create-shift.dto';
import { UpdateShiftDto } from '../dto/update-shift.dto';

@Injectable()
export class ShiftsService {
    constructor(
        @InjectRepository(Shift)
        private readonly repo: Repository<Shift>,
    ) { }

    async listByDriverAndRange(driverId: number, from?: string, to?: string): Promise<Shift[]> {
        const where: any = { driver_id: driverId };
        if (from && to) {
            where.date = Between(from, to);
        } else if (from) {
            where.date = Between(from, from);
        } else if (to) {
            where.date = Between(to, to);
        }
        return this.repo.find({
            where,
            order: { date: 'ASC', start_time: 'ASC' },
        });
    }

    /** جلوگیری از هم‌پوشانی زمانی برای همان راننده در همان روز */
    private async assertNoOverlap(
        driver_id: number,
        date: string,
        start: string,
        end: string,
        ignoreId?: number,
    ) {
        if (end <= start) throw new BadRequestException('ساعت پایان باید بعد از ساعت شروع باشد');

        const qb = this.repo
            .createQueryBuilder('s')
            .where('s.driver_id = :driver_id', { driver_id })
            .andWhere('s.date = :date', { date });

        if (ignoreId) qb.andWhere('s.id <> :ignoreId', { ignoreId });

        // هم‌پوشانی: (start < existing_end) AND (end > existing_start)
        qb.andWhere('s.start_time < :end AND s.end_time > :start', { start, end });

        const exists = await qb.getOne();
        if (exists) {
            throw new BadRequestException('این بازه زمانی با شیفت دیگری برای این راننده تداخل دارد');
        }
    }

    async create(dto: CreateShiftDto): Promise<Shift> {
        await this.assertNoOverlap(dto.driver_id, dto.date, dto.start_time, dto.end_time);

        const entity = this.repo.create({
            ...dto,
            vehicle_id: dto.vehicle_id ?? null,
            route_id: dto.route_id ?? null,
            station_start_id: dto.station_start_id ?? null,
            station_end_id: dto.station_end_id ?? null,
            status: dto.status ?? ShiftStatus.DRAFT,
            note: dto.note ?? null,
        });

        return this.repo.save(entity);
    }

    async update(id: number, dto: UpdateShiftDto): Promise<Shift> {
        const current = await this.repo.findOne({ where: { id } });
        if (!current) throw new NotFoundException('شیفت پیدا نشد');

        // قفل‌شده قابل ویرایش نیست
        if (current.status === ShiftStatus.LOCKED) {
            throw new BadRequestException('شیفت قفل است و قابل ویرایش نیست');
        }

        // آیا تغییری در زمان/تاریخ/راننده رخ داده؟
        const changedTime =
            (dto.date !== undefined && dto.date !== current.date) ||
            (dto.start_time !== undefined && dto.start_time !== current.start_time) ||
            (dto.end_time !== undefined && dto.end_time !== current.end_time) ||
            (dto.driver_id !== undefined && dto.driver_id !== current.driver_id);

        // اگر لازم بود، تداخل زمانی را چک کن
        const merged = { ...current, ...dto } as Shift;
        if (changedTime) {
            await this.assertNoOverlap(
                merged.driver_id,
                merged.date,
                merged.start_time,
                merged.end_time,
                id,
            );
        }

        // جلوگیری از عقب‌گرد وضعیت
        if (dto.status !== undefined && dto.status !== null) {
            const nextStatus = dto.status as ShiftStatus;
            // این شرط اضافی بود و حذف شد:
            // if (current.status === ShiftStatus.LOCKED && nextStatus !== ShiftStatus.LOCKED) { ... }

            if (current.status === ShiftStatus.PUBLISHED && nextStatus === ShiftStatus.DRAFT) {
                throw new BadRequestException('بازگردانی وضعیت از منتشر شده به پیش‌نویس مجاز نیست');
            }
        }

        Object.assign(current, merged);
        return this.repo.save(current);
    }

    async remove(id: number): Promise<void> {
        const s = await this.repo.findOne({ where: { id } });
        if (!s) return;
        await this.repo.delete(id);
    }

    async publish(id: number): Promise<Shift> {
        const s = await this.repo.findOne({ where: { id } });
        if (!s) throw new NotFoundException('شیفت پیدا نشد');
        if (s.status !== ShiftStatus.DRAFT) {
            throw new BadRequestException('فقط پیش‌نویس قابل انتشار است');
        }
        s.status = ShiftStatus.PUBLISHED;
        return this.repo.save(s);
    }

    async lock(id: number): Promise<Shift> {
        const s = await this.repo.findOne({ where: { id } });
        if (!s) throw new NotFoundException('شیفت پیدا نشد');
        if (s.status !== ShiftStatus.PUBLISHED) {
            throw new BadRequestException('فقط شیفت منتشرشده قابل قفل است');
        }
        s.status = ShiftStatus.LOCKED;
        return this.repo.save(s);
    }
}
