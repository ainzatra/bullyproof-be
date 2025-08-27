import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import getLocalIP from './getLocalIp';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: '*',
    credentials: true,
  })
  
  // Enable global validation and automatic transformation for incoming DTOs
  // This ensures strings like "2025-08-27" are transformed to Date instances
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );
  const ip = getLocalIP()
  const port = process.env.PORT ?? 3000;

  await app.listen(port);
  process.stdout.write('\x1Bc'); // Clear console
  console.log(`Server is running on: http://${ip}:${port}`)
}
bootstrap();
