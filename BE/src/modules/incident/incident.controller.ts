import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IncidentService } from './incident.service';
import { CreateIncidentDto } from './dto/create-incident.dto';

@Controller('incidents')
export class IncidentController {
  constructor(private incidentService: IncidentService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() dto: CreateIncidentDto, @Req() req: any) {
    const incident = await this.incidentService.create(dto, req.user.userId);
    return { message: 'Incident reported', data: incident };
  }

  @Get()
  async findNearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius: string,
  ) {
    const incidents = await this.incidentService.findNearby(
      parseFloat(lat),
      parseFloat(lng),
      radius ? parseFloat(radius) : 500,
    );
    return { data: incidents };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/resolve')
  async resolve(@Param('id', ParseUUIDPipe) id: string) {
    const incident = await this.incidentService.resolve(id);
    return { message: 'Incident resolved', data: incident };
  }
}
