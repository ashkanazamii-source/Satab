import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { TemporaryAssignmentsService } from './temporary-assignments.service';

@Injectable()
export class TemporaryAssignmentsScheduler {
  constructor(private readonly svc: TemporaryAssignmentsService) {}

  @Interval(60_000)
  async sweep() {
    await this.svc.tick();
  }
}
