import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AllowedCountry } from './allowed-country.entity';
import { UpdateAllowedCountriesDto } from '../dto/update-allowed-countries.dto';

@Injectable()
export class AllowedCountriesService {
  constructor(@InjectRepository(AllowedCountry) private repo: Repository<AllowedCountry>) {}

  async getForUser(userId: number) {
    const rows = await this.repo.find({ where: { user_id: userId } });
    return rows.map(r => r.country_code);
  }

  async replaceForUser(userId: number, dto: UpdateAllowedCountriesDto) {
    // حذف‌های اضافه
    await this.repo.delete({ user_id: userId });
    // درج جدید
    const rows = dto.countries.map(code => this.repo.create({ user_id: userId, country_code: code }));
    await this.repo.save(rows);
    return this.getForUser(userId);
  }
}
