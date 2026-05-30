import { Body, Controller, Post } from '@nestjs/common';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('push-token')
  async registerPushToken(@Body() dto: RegisterPushTokenDto) {
    return {
      message: 'Push token registered',
      data: await this.notificationsService.registerToken(dto),
    };
  }
}
