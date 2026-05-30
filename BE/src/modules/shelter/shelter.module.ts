import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shelter } from './shelter.entity';
import { ShelterService } from './shelter.service';
import { ShelterController } from './shelter.controller';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [TypeOrmModule.forFeature([Shelter]), EventsModule],
  controllers: [ShelterController],
  providers: [ShelterService],
  exports: [ShelterService],
})
export class ShelterModule {}
