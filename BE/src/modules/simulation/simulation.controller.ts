import { Body, Controller, Delete, Post } from '@nestjs/common';
import { SimulationService } from './simulation.service';
import { SimulateAirstrikeDto } from './dto/simulate-airstrike.dto';

@Controller('simulation')
export class SimulationController {
  constructor(private simulationService: SimulationService) {}

  @Post('airstrike')
  async simulateAirstrike(@Body() dto: SimulateAirstrikeDto) {
    const result = await this.simulationService.simulateAirstrike(
      dto.flightPath,
      dto.count,
    );
    return {
      message: `Đã dự đoán ${result.zones.length} điểm thả bom dọc đường bay`,
      data: result,
    };
  }

  @Delete('airstrike')
  async clear() {
    const result = await this.simulationService.clearSimulation();
    return { message: `Đã xoá ${result.cleared} vùng mô phỏng`, data: result };
  }
}
