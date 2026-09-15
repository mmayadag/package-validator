import { type INestApplication, ValidationPipe } from '@nestjs/common';

/** Settings shared by the real server and the e2e tests. */
export function configureApp(app: INestApplication): INestApplication {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();
  return app;
}
