import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { OptionalJwtGuard } from '../auth/optional-jwt.guard';
import { RouteService } from './route.service';
import { CalculateRouteDto } from './dto/calculate-route.dto';

@Controller('route')
export class RouteController {
  constructor(private routeService: RouteService) {}

  @UseGuards(OptionalJwtGuard)
  @Post('calculate')
  async calculate(@Body() dto: CalculateRouteDto, @Req() req: any) {
    const result = await this.routeService.calculateRoute(
      dto,
      req.user?.userId,
    );
    return { message: 'Route calculated', data: result };
  }
}
