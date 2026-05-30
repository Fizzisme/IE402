import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { ShelterModule } from './modules/shelter/shelter.module';
import { DangerZonesModule } from './modules/danger-zones/danger-zones.module';
import { IncidentModule } from './modules/incident/incident.module';
import { RouteModule } from './modules/route/route.module';
import { MapModule } from './modules/map/map.module';
import { EventsModule } from './modules/events/events.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SimulationModule } from './modules/simulation/simulation.module';

@Module({
  imports: [
    //   Đọc env và inject vào toàn app
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isSsl = config.get<string>('DB_SSL', 'false') === 'true';
        return {
          type: 'postgres',
          host: config.get<string>('DB_HOST', 'localhost'),
          port: config.get<number>('DB_PORT', 5432),
          username: config.get<string>('DB_USERNAME', 'postgres'),
          password: config.get<string>('DB_PASSWORD', ''),
          database: config.get<string>('DB_NAME', 'evacuation_db'),
          ssl: isSsl ? { rejectUnauthorized: false } : false,
          autoLoadEntities: true,
          synchronize: false,
          extra: {
            keepAlive: true,
            keepAliveInitialDelayMillis: 10000,
            connectionTimeoutMillis: 10000,
          },
        };
      },
    }),
    AuthModule,
    UserModule,
    ShelterModule,
    DangerZonesModule,
    IncidentModule,
    RouteModule,
    MapModule,
    NotificationsModule,
    EventsModule,
    SimulationModule,
  ],
})
export class AppModule {}
