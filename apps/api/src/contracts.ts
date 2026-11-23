import { z } from 'zod';

export const categories = [
  { id: 'lighting', label: 'Iluminación', hint: 'Luces y postes' },
  { id: 'water', label: 'Agua y baños', hint: 'Plomería y grifos' },
  { id: 'play', label: 'Juegos y mobiliario', hint: 'Juegos, bancas y canchas' },
  { id: 'cleaning', label: 'Limpieza', hint: 'Residuos y aseo' },
  { id: 'paths', label: 'Senderos y accesibilidad', hint: 'Pisos, rampas y caminos' },
  { id: 'other', label: 'Otro / No sé', hint: 'Cualquier otra novedad' },
] as const;

export const coordinates = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const submission = z.object({
  point: coordinates,
  method: z.enum(['gps', 'manual']),
  accuracyM: z.number().nonnegative().max(100000).optional(),
  detail: z.string().trim().min(3).max(120),
  category: z.enum(['lighting', 'water', 'play', 'cleaning', 'paths', 'other']),
  description: z.string().trim().min(10).max(500),
  risk: z.enum(['yes', 'no', 'unsure']),
  email: z.email().max(254).optional(),
  consent: z.literal('demo-1').optional(),
}).strict().refine((value) => Boolean(value.email) === Boolean(value.consent), {
  path: ['consent'],
  message: 'Confirma la autorización para guardar tu correo.',
}).refine((value) => value.method === 'gps' || value.accuracyM === undefined, {
  path: ['accuracyM'],
  message: 'La precisión solo aplica a puntos GPS.',
});

export const accessKey = z.string().uuid({ version: 'v4' });
export const lookup = z.object({
  reference: z.string().trim().toUpperCase().regex(/^DEMO-\d{4,16}$/),
  key: accessKey,
}).strict();

export type Coordinates = z.infer<typeof coordinates>;
export type Submission = z.infer<typeof submission>;
