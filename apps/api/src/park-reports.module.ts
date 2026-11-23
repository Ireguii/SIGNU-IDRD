import { type DynamicModule, Module } from '@nestjs/common';
import type { Database } from './database';
import { DATABASE, ParksService } from './parks';
import { ReportsController, ReportsService } from './reports';
import { TicketsService } from './tickets';

@Module({})
export class ParkReportsModule {
  static register(database: Database): DynamicModule {
    return {
      module: ParkReportsModule,
      controllers: [ReportsController],
      providers: [ReportsService, ParksService, TicketsService, { provide: DATABASE, useValue: database }],
    };
  }
}
