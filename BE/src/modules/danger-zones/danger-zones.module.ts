import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DangerZone } from './danger-zone.entity';
import { DangerZonesService } from './danger-zones.service';
import { DangerZonesController } from './danger-zones.controller';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [TypeOrmModule.forFeature([DangerZone]), EventsModule],
  controllers: [DangerZonesController],
  providers: [DangerZonesService],
  exports: [DangerZonesService],
})
export class DangerZonesModule {}
