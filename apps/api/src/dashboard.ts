import {
  Body, Controller, Get, Header, Inject, Module, Param, Patch, Query, Res, StreamableFile,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import type { Request, Response, NextFunction } from 'express';
import { resolve } from 'node:path';
import { categories } from './contracts';
import type { Database } from './database';
import { DATABASE } from './parks';
import { validate } from './reports';
import { priorities, queueQuery, referenceSchema, statuses, ticketChange, TicketsService } from './tickets';

const assets = resolve(__dirname, '../dashboard');

@Controller()
class DashboardController {
  constructor(@Inject(TicketsService) private readonly tickets: TicketsService) {}

  @Get()
  index(@Res() response: Response) {
    return response.sendFile(resolve(assets, 'index.html'));
  }

  @Get('panel.css')
  css(@Res() response: Response) {
    return response.sendFile(resolve(assets, 'panel.css'));
  }

  @Get('panel.js')
  script(@Res() response: Response) {
    return response.sendFile(resolve(assets, 'panel.js'));
  }

  @Get('tickets/options')
  options() {
    return { categories, statuses, priorities };
  }

  @Get('tickets')
  list(@Query() query: unknown) {
    return this.tickets.list(validate(queueQuery, query));
  }

  @Get('tickets/:reference')
  detail(@Param('reference') reference: string) {
    return this.tickets.detail(validate(referenceSchema, reference));
  }

  @Get('tickets/:reference/photo')
  @Header('Content-Type', 'image/jpeg')
  async photo(@Param('reference') reference: string) {
    return new StreamableFile(await this.tickets.photo(validate(referenceSchema, reference)));
  }

  @Patch('tickets/:reference')
  update(@Param('reference') reference: string, @Body() body: unknown) {
    return this.tickets.update(validate(referenceSchema, reference), validate(ticketChange, body));
  }
}

export async function makeDashboardApp(db: Database) {
  @Module({
    controllers: [DashboardController],
    providers: [TicketsService, { provide: DATABASE, useValue: db }],
  })
  class DashboardModule {}
  const app = await NestFactory.create<NestExpressApplication>(DashboardModule, { logger: ['error', 'warn'], abortOnError: false });
  app.use(helmet({
    contentSecurityPolicy: { directives: { upgradeInsecureRequests: null, imgSrc: ["'self'", 'data:'] } },
    strictTransportSecurity: false,
  }));
  app.use((req: Request, res: Response, next: NextFunction) => {
    const host = req.headers.host ?? '';
    const origin = req.headers.origin;
    const fetchSite = req.headers['sec-fetch-site'];
    const opensDashboard = req.method === 'GET' && req.path === '/' &&
      req.headers['sec-fetch-mode'] === 'navigate' &&
      req.headers['sec-fetch-dest'] === 'document';
    const fromAnotherOrigin = fetchSite === 'cross-site' || fetchSite === 'same-site';

    if (!/^(?:127\.0\.0\.1|localhost)(?::\d{1,5})?$/.test(host) ||
      (origin && origin !== `http://${host}`) ||
      (fromAnotherOrigin && !opensDashboard)) {
      return res.status(403).json({ message: 'El panel solo acepta solicitudes del navegador local.' });
    }
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.useBodyParser('json', { limit: '8kb' });
  return app;
}
