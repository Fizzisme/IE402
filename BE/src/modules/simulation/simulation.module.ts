import { Module } from '@nestjs/common';
import { SimulationService } from './simulation.service';
import { SimulationController } from './simulation.controller';
import { AirstrikeAiService } from './airstrike-ai.service';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [EventsModule],
  controllers: [SimulationController],
  providers: [SimulationService, AirstrikeAiService],
})
export class SimulationModule {}
