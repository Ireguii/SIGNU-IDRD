import {
  BadRequestException, Body, ConflictException, Controller, Get, Header, Headers,
  HttpCode, Inject, Injectable, NotFoundException, Post, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';
import { accessKey, categories, coordinates, lookup, submission, type Submission } from './contracts';
import type { Database } from './database';
import { DATABASE, ParksService } from './parks';
import { TicketsService, type Status } from './tickets';

type Row = {
  reference: string;
  created_at: Date | string;
  category: string;
  park_name: string | null;
  locality: string | null;
  request_hash: string;
  status: Status;
  version: number;
  updated_at: Date | string | null;
};

const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

export function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestException({ message: 'Revisa los datos del reporte.', fields: result.error.flatten().fieldErrors });
  }
  return result.data;
}

async function preparePhoto(file?: Express.Multer.File) {
  if (!file) return null;
  try {
    const image = sharp(file.buffer, { limitInputPixels: 30_000_000, failOn: 'error' });
    const { format } = await image.metadata();
    if (format !== 'jpeg' && format !== 'png' && format !== 'webp') throw new Error('Formato inválido');
    // Re-encoding drops EXIF, including GPS and device identifiers.
    return await image.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' }).jpeg({ quality: 82 }).toBuffer();
  } catch {
    throw new BadRequestException('Adjunta una fotografía válida en JPG, PNG o WebP.');
  }
}

@Injectable()
export class ReportsService {
  constructor(@Inject(DATABASE) private readonly db: Database, @Inject(ParksService) private readonly parks: ParksService, @Inject(TicketsService) private readonly tickets: TicketsService) {}

  async create(data: Submission, key: string, upload?: Express.Multer.File) {
    const accessHash = sha256(key);
    const requestHash = sha256(JSON.stringify([data, upload ? sha256(upload.buffer) : null]));
    const [existing] = await this.db.query<Row>('SELECT reference, created_at, category, park_name, locality, request_hash, status, version, updated_at FROM park_reports.reports WHERE access_hash = $1', [accessHash]);
    if (existing) return this.receipt(existing, requestHash);

    const photo = await preparePhoto(upload);
    const match = await this.parks.identify(data.point);
    const [saved] = await this.db.query<Row>(`INSERT INTO park_reports.reports (
      access_hash, request_hash, category, description, location, location_method, accuracy_m,
      detail, park_name, locality, park_source, risk, email, consent_version, photo_jpeg
    ) VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326), $7, $8, $9,
      $10, $11, $12, $13, $14, $15, $16)
    ON CONFLICT (access_hash) DO NOTHING
    RETURNING reference, created_at, category, park_name, locality, request_hash, status, version, updated_at`, [
      accessHash, requestHash, data.category, data.description, data.point.longitude, data.point.latitude,
      data.method, data.accuracyM ?? null, data.detail, match.park?.name ?? null, match.park?.locality ?? null,
      match.source, data.risk, data.email ?? null, data.consent ?? null, photo,
    ]);
    if (saved) return this.receipt(saved, requestHash);

    const [concurrent] = await this.db.query<Row>('SELECT reference, created_at, category, park_name, locality, request_hash, status, version, updated_at FROM park_reports.reports WHERE access_hash = $1', [accessHash]);
    return this.receipt(concurrent, requestHash);
  }

  async find(reference: string, key: string) {
    const [report] = await this.db.query<Row>(`SELECT reference, created_at, category, park_name, locality, status, version, updated_at
      FROM park_reports.reports WHERE reference = $1 AND access_hash = $2`, [reference, sha256(key)]);
    if (!report) throw new NotFoundException('No se encontró el reporte con esa referencia y clave.');
    return this.publicReport(report);
  }

  private receipt(row: Row, requestHash: string) {
    if (row.request_hash !== requestHash) throw new ConflictException('Esta clave ya corresponde a otro envío.');
    return this.publicReport(row);
  }

  private async publicReport(row: Row) {
    return {
      reference: row.reference,
      createdAt: new Date(row.created_at).toISOString(),
      category: row.category,
      parkName: row.park_name,
      locality: row.locality,
      status: row.status,
      updatedAt: new Date(row.updated_at ?? row.created_at).toISOString(),
      history: (await this.tickets.history(row.reference, row.created_at, row.version))
        .map(({ version, status, publicNote, at }) => ({ version, status, publicNote, at })),
      demo: true,
    };
  }
}

@Controller('api/v1/park-reports')
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reports: ReportsService, @Inject(ParksService) private readonly parks: ParksService) {}

  @Get('categories')
  listCategories() {
    return categories;
  }

  @Post('park-match')
  @HttpCode(200)
  identify(@Body() body: unknown) {
    return this.parks.identify(validate(coordinates.strict(), body));
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  @UseInterceptors(FileInterceptor('photo', {
    limits: { files: 1, fields: 1, parts: 3, fileSize: 8 * 1024 * 1024, fieldSize: 4096 },
  }))
  create(
    @Body('report') body: unknown,
    @Headers('x-report-key') key: unknown,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (typeof body !== 'string') throw new BadRequestException('Falta la información del reporte.');
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      throw new BadRequestException('El reporte debe enviarse como JSON válido.');
    }
    return this.reports.create(validate(submission, payload), validate(accessKey, key), file);
  }

  @Post('lookup')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  find(@Body() body: unknown) {
    const { reference, key } = validate(lookup, body);
    return this.reports.find(reference, key);
  }
}
