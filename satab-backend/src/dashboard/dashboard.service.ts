import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Users } from '../users/users.entity';
//import { Log } from '../log/log.entity'; // اگر لاگ داری

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Users)
    private readonly userRepo: Repository<Users>,
    //@InjectRepository(Log)
    //private readonly logRepo: Repository<Log>,
  ) {}

  async getSummaryForManager() {
    const totalUsers = await this.userRepo.count();
    //const totalLogs = await this.logRepo.count(); // اگر لاگ داری
    const latestUsers = await this.userRepo.find({
      order: { created_at: 'DESC' },
      take: 5,
    });

    return {
      totalUsers,
      //totalLogs,
      latest: { users: latestUsers },
    };
  }
  async getRoleManagementData() {
  const allUsers = await this.userRepo.find({
    order: { created_at: 'DESC' },
    select: ['id', 'full_name', 'phone', 'role_level', 'created_at'],
  });

  return {
    users: allUsers,
  };
}

}
