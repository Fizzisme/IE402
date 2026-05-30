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
import { ShelterService } from './shelter.service';
import { CreateShelterDto } from './dto/create-shelter.dto';
import { FindNearestDto } from './dto/find-nearest.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { CheckinDto } from './dto/checkin.dto';

@Controller('shelters')
export class ShelterController {
  constructor(private shelterService: ShelterService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() dto: CreateShelterDto) {
    const shelter = await this.shelterService.create(dto);
    return { message: 'Shelter created', data: shelter };
  }

  @Get()
  async findAll() {
    const shelters = await this.shelterService.findAll();
    return { data: shelters };
  }

  @Get('nearest')
  async findNearest(@Query() query: FindNearestDto) {
    const shelters = await this.shelterService.findNearest(query);
    return { data: shelters };
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-active-checkin')
  async myActiveCheckin(@Req() req: any) {
    const checkin = await this.shelterService.getActiveCheckin(req.user.userId);
    return { data: checkin };
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const shelter = await this.shelterService.findById(id);
    return { data: shelter };
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/checkin')
  async checkin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CheckinDto,
    @Req() req: any,
  ) {
    const result = await this.shelterService.checkin(
      id,
      req.user.userId,
      dto.lat,
      dto.lng,
    );
    return { message: 'Checked in successfully', data: result };
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/checkout')
  async checkout(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    const result = await this.shelterService.checkout(id, req.user.userId);
    return { message: 'Checked out successfully', data: result };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    const shelter = await this.shelterService.updateStatus(id, dto.status);
    return { message: 'Status updated', data: shelter };
  }
}
