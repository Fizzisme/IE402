import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Xóa field không có trong DTO
      forbidNonWhitelisted: false, // Throw ra field lỗi
      transform: true, // convert type theo DTO
      transformOptions: { enableImplicitConversion: true }, // Convert các dạng như query, params
    }),
  );

  app.enableCors();

  app.setGlobalPrefix('api/v1');

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Application running on port ${process.env.PORT ?? 3000}`);
}
bootstrap();
