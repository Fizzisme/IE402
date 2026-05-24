import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserService } from './user.service';
import { UpdateLocationDto } from './dto/update-location.dto';

@Controller('users')
export class UserController {
  constructor(private userService: UserService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Req() req: any) {
    const profile = await this.userService.getProfile(req.user.userId);
    return { data: profile };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/location')
  async updateLocation(@Req() req: any, @Body() dto: UpdateLocationDto) {
    await this.userService.updateLocation(req.user.userId, dto.lat, dto.lng);
    return { message: 'Location updated successfully' };
  }
}
