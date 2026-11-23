import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import type { Database } from './database';
import { DATABASE } from './parks';

export const statuses = ['pending_review', 'in_review', 'approved', 'in_progress', 'resolved', 'rejected'] as const;
export const priorities = ['critical', 'medium', 'low'] as const;
export type Status = typeof statuses[number];
type Priority = typeof priorities[number];

const transitions: Record<Status, readonly Status[]> = {
  pending_review: ['in_review', 'approved', 'rejected'],
  in_review: ['approved', 'rejected'],
  approved: ['in_progress'],
  in_progress: ['resolved'],
  resolved: [],
  rejected: [],
};

export const referenceSchema = z.string().regex(/^DEMO-\d{4,16}$/);
export const queueQuery = z.object({
  status: z.enum(statuses).optional(),
  priority: z.enum(priorities).optional(),
  q: z.string().trim().max(80).default(''),
  page: z.coerce.number().int().min(1).max(10000).default(1),
}).strict();
export const ticketChange = z.object({
  version: z.number().int().nonnegative(),
  status: z.enum(statuses),
  priority: z.enum(priorities).nullable(),
  publicNote: z.string().trim().max(240).optional(),
}).strict().superRefine((data, context) => {
  if (data.status === 'rejected' && !data.publicNote) {
    context.addIssue({ code: 'custom', path: ['publicNote'], message: 'Escribe el motivo que verá la persona.' });
  }
  if (['approved', 'in_progress', 'resolved'].includes(data.status) && !data.priority) {
    context.addIssue({ code: 'custom', path: ['priority'], message: 'Selecciona una prioridad antes de aprobar.' });
  }
});

export type TicketEvent = {
  version: number;
  status: Status;
  priority: Priority | null;
  publicNote: string | null;
  at: string;
};
type Ticket = {
  reference: string; category: string; parkName: string | null; locality: string | null;
  description: string; detail: string; status: Status; priority: Priority | null; version: number;
  risk: string; createdAt: string; updatedAt: string; hasPhoto: boolean;
};
const summary = `reference, category, park_name AS "parkName", locality, description, detail,
  status, priority, version, risk, created_at AS "createdAt",
  COALESCE(updated_at, created_at) AS "updatedAt", photo_jpeg IS NOT NULL AS "hasPhoto"`;

@Injectable()
export class TicketsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async list({ status, priority, q, page }: z.infer<typeof queueQuery>) {
    const where = `($1::text IS NULL OR status = $1)
      AND ($2::text IS NULL OR priority = $2)
      AND ($3 = '' OR strpos(lower(concat_ws(' ', reference, park_name, locality, detail, description)), lower($3)) > 0)`;
    const values = [status ?? null, priority ?? null, q];
    const [rows, [count], counts] = await Promise.all([
      this.db.query<Ticket>(`SELECT ${summary} FROM park_reports.reports WHERE ${where}
        ORDER BY created_at DESC, reference DESC LIMIT 20 OFFSET $4`, [...values, (page - 1) * 20]),
      this.db.query<{ total: number }>(`SELECT count(*)::int AS total FROM park_reports.reports WHERE ${where}`, values),
      this.db.query<{ status: Status; count: number }>('SELECT status, count(*)::int AS count FROM park_reports.reports GROUP BY status'),
    ]);
    return { rows, page, pages: Math.max(1, Math.ceil(count.total / 20)), counts };
  }

  async detail(reference: string) {
    const [ticket] = await this.db.query<Ticket & {
      latitude: number; longitude: number; method: string; accuracyM: number | null;
      parkSource: string | null; email: string | null;
    }>(`SELECT ${summary}, ST_Y(location) AS latitude, ST_X(location) AS longitude,
      location_method AS method, accuracy_m AS "accuracyM", park_source AS "parkSource", email
      FROM park_reports.reports WHERE reference = $1`, [reference]);
    if (!ticket) throw new NotFoundException('El ticket no existe.');
    return { ...ticket, nextStatuses: transitions[ticket.status],
      history: await this.history(reference, ticket.createdAt, ticket.version) };
  }

  async history(reference: string, createdAt: string | Date, version: number): Promise<TicketEvent[]> {
    const events = await this.db.query<TicketEvent>(`SELECT version, status, priority, public_note AS "publicNote",
      changed_at AS at FROM park_reports.ticket_history WHERE reference = $1 AND version <= $2
      ORDER BY version`, [reference, version]);
    return [{ version: 0, status: 'pending_review', priority: null, publicNote: null, at: new Date(createdAt).toISOString() }, ...events];
  }

  async photo(reference: string): Promise<Buffer> {
    const [record] = await this.db.query<{ photo: Uint8Array | null }>(
      'SELECT photo_jpeg AS photo FROM park_reports.reports WHERE reference = $1', [reference]);
    if (!record?.photo) throw new NotFoundException('El ticket no tiene una foto.');
    return Buffer.from(record.photo);
  }

  async update(reference: string, change: z.infer<typeof ticketChange>) {
    const [current] = await this.db.query<{ status: Status; version: number }>(
      'SELECT status, version FROM park_reports.reports WHERE reference = $1', [reference]);
    if (!current) throw new NotFoundException('El ticket no existe.');
    if (current.version !== change.version) throw new ConflictException('El ticket cambió. Actualiza el detalle y vuelve a intentarlo.');
    if (!transitions[current.status].includes(change.status)) {
      throw new ConflictException('Este cambio de estado no está disponible.');
    }
    const [saved] = await this.db.query<{ version: number }>(`WITH changed AS (
      UPDATE park_reports.reports
      SET status = $3, priority = $4, version = version + 1, updated_at = now()
      WHERE reference = $1 AND version = $2
      RETURNING reference, version, status, priority, updated_at
    )
    INSERT INTO park_reports.ticket_history (reference, version, status, priority, public_note, changed_at)
    SELECT reference, version, status, priority, $5, updated_at FROM changed
    RETURNING version`, [reference, change.version, change.status, change.priority, change.publicNote || null]);
    if (!saved) throw new ConflictException('El ticket cambió. Actualiza el detalle y vuelve a intentarlo.');
    return this.detail(reference);
  }
}
