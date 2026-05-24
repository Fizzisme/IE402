import { Controller, Get } from '@nestjs/common';
import { MapService } from './map.service';

@Controller('map')
export class MapController {
  constructor(private mapService: MapService) {}

  @Get('shelters')
  async getShelters() {
    return this.mapService.getSheltersGeoJSON();
  }

  @Get('danger-zones')
  async getDangerZones() {
    return this.mapService.getDangerZonesGeoJSON();
  }

  @Get('incidents')
  async getIncidents() {
    return this.mapService.getIncidentsGeoJSON();
  }
}
