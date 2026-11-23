import 'reflect-metadata';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { resolve } from 'node:path';
import type { Database } from './database';
import { ParkReportsModule } from './park-reports.module';

@Controller()
class HealthController {
  @Get('health')
  status() {
    return { status: 'ok', mode: 'demo' };
  }
}

export async function makeApp(db: Database, webDist?: string) {
  @Module({
    imports: [ParkReportsModule.register(db)],
    controllers: [HealthController],
  })
  class DemoApplicationModule {}

  const app = await NestFactory.create<NestExpressApplication>(DemoApplicationModule, {
    logger: ['error', 'warn'],
    abortOnError: false,
  });
  app.use(webDist ? helmet({
    contentSecurityPolicy: {
      directives: {
        scriptSrc: ["'self'", "'unsafe-inline'"], // Expo's static HTML includes an inline bootstrap script.
        imgSrc: ["'self'", 'blob:', 'data:', 'https://tile.openstreetmap.org'],
        fontSrc: ["'self'", 'data:'],
        upgradeInsecureRequests: null,
      },
    },
    strictTransportSecurity: false,
  }) : helmet());
  app.useBodyParser('json', { limit: '8kb' });
  const localOrigins = ['http://localhost:8081', 'http://127.0.0.1:8081'];
  const configuredOrigins = (process.env.WEB_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  const origins = [...localOrigins, ...configuredOrigins];
  app.enableCors({ origin: origins, allowedHeaders: ['content-type', 'x-report-key'] });
  app.use('/api/v1/park-reports', rateLimit({
    limit: 45,
    windowMs: 60_000,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Hay demasiadas solicitudes. Inténtalo de nuevo en un minuto.' },
  }));
  if (webDist) {
    // Expo exports some fonts and icons under a directory named .pnpm.
    const packagedAssets = '/assets/__node_modules/.pnpm';
    app.useStaticAssets(resolve(webDist, 'assets/__node_modules/.pnpm'), {
      prefix: packagedAssets, dotfiles: 'deny', redirect: false,
    });
    app.useStaticAssets(webDist, { extensions: ['html'], dotfiles: 'deny' });
  }
  return app;
}
