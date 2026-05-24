import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DangerZonesService } from './danger-zones.service';
import { CreateDangerZoneDto } from './dto/create-danger-zone.dto';
import { ClusterZonesDto } from './dto/cluster-zones.dto';
import { ImportAcledDto } from './dto/import-acled.dto';
import { ImportUcdpDto } from './dto/import-ucdp.dto';

@Controller('danger-zones')
export class DangerZonesController {
  constructor(private dangerZonesService: DangerZonesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() dto: CreateDangerZoneDto, @Req() req: any) {
    const zone = await this.dangerZonesService.create(dto, req.user.userId);
    return { message: 'Danger zone created', data: zone };
  }

  @Get()
  async findAll(
    @Query('limit')  limit?: string,
    @Query('offset') offset?: string,
    @Query('bbox')   bbox?: string,   // "minLng,minLat,maxLng,maxLat"
  ) {
    let parsedBbox: { minLng: number; minLat: number; maxLng: number; maxLat: number } | undefined;
    if (bbox) {
      const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
      if ([minLng, minLat, maxLng, maxLat].every(n => !isNaN(n))) {
        parsedBbox = { minLng, minLat, maxLng, maxLat };
      }
    }
    return this.dangerZonesService.findAll({
      limit:  limit  ? parseInt(limit)  : undefined,
      offset: offset ? parseInt(offset) : undefined,
      bbox:   parsedBbox,
    });
  }

  @Get('check')
  async checkLocation(@Query('lat') lat: string, @Query('lng') lng: string) {
    const result = await this.dangerZonesService.checkLocation(
      parseFloat(lat),
      parseFloat(lng),
    );
    return { data: result };
  }

  @UseGuards(JwtAuthGuard)
  @Post('import/acled')
  async importAcled(@Body() dto: ImportAcledDto, @Req() req: any) {
    const result = await this.dangerZonesService.importAcled(
      dto.events,
      req.user.userId,
    );
    return {
      message: `ACLED import done: ${result.imported} imported, ${result.skipped} skipped (duplicates)`,
      data: result,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('import/ucdp')
  async importUcdp(@Body() dto: ImportUcdpDto, @Req() req: any) {
    const result = await this.dangerZonesService.importUcdp(
      dto.events,
      req.user.userId,
    );
    return {
      message: `UCDP import done: ${result.imported} imported, ${result.skipped} skipped (duplicates)`,
      data: result,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('cluster')
  async clusterZones(@Body() dto: ClusterZonesDto) {
    const result = await this.dangerZonesService.clusterZones(
      dto.eps,
      dto.min_points,
      dto.include_manual,
    );
    return {
      message: `Clustering done: ${result.clusters} clusters created, ${result.penalties_updated} roads updated`,
      data: result,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('refresh-penalties')
  async refreshPenalties() {
    const result = await this.dangerZonesService.refreshPenalties();
    return { message: `Penalties refreshed: ${result.updated} roads updated`, data: result };
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    const zone = await this.dangerZonesService.softDelete(id);
    return { message: 'Danger zone deactivated', data: zone };
  }
}
