import { Platform } from 'react-native';
import type { ReportStatus } from './status';

export function getDefaultApiUrl() {
  if (Platform.OS === 'web' && process.env.EXPO_PUBLIC_SAME_ORIGIN === '1') return '';
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  const configured = apiUrl?.trim();
  if (configured) return configured;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;
    if (protocol === 'http:') return `http://${hostname}:3100`;
    if (protocol === 'https:' && hostname.endsWith('.ts.net')) return `https://${hostname}:8443`;
  }
  return 'http://localhost:3100';
}
export const officialPqrs = 'https://www.idrd.gov.co/atencion-servicios-ciudadania/radique-su-PQRSD';

export type Point = { latitude: number; longitude: number };
export type ParkMatch = { source: 'public' | 'snapshot'; park: { name: string; locality: string } | null };
export type Risk = 'yes' | 'no' | 'unsure';
export type CategoryId = 'lighting' | 'water' | 'play' | 'cleaning' | 'paths' | 'other';
export type Category = { id: CategoryId; label: string; hint: string };
export type Photo = { uri: string; size?: number; name?: string; mimeType?: string; file?: File };
export type Report = {
  reference: string; category: CategoryId; createdAt: string; parkName: string | null;
  locality: string | null; status: ReportStatus; updatedAt: string; demo: true;
  history: { version: number; status: ReportStatus; publicNote: string | null; at: string }[];
};
export type ReportInput = {
  point: Point; method: 'gps' | 'manual'; accuracyM?: number; detail: string;
  category: CategoryId; description: string; risk: Risk; email?: string; consent?: 'demo-1';
};

export const initialPoint = { latitude: 4.658, longitude: -74.093 };
export const demoPoints = [
  { label: 'Simón Bolívar', point: initialPoint },
  { label: 'Los Novios', point: { latitude: 4.654678, longitude: -74.082017 } },
  { label: 'El Tunal', point: { latitude: 4.571204, longitude: -74.133423 } },
];

export function createReportsApi(baseUrl: string) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    const upstreamSignal = init.signal;
    upstreamSignal?.addEventListener('abort', abort, { once: true });
    if (upstreamSignal?.aborted) controller.abort();
    const timeout = setTimeout(abort, 15_000);
    try {
      const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/v1/park-reports${path}`, {
        ...init, signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) {
        const message = response.status === 413 ? 'La foto supera el máximo de 8 MB.' : data.message;
        throw new Error(typeof message === 'string' ? message : 'No pudimos completar la solicitud.');
      }
      return data as T;
    } finally {
      clearTimeout(timeout);
      upstreamSignal?.removeEventListener('abort', abort);
    }
  }

  function post<T>(path: string, value: unknown, signal?: AbortSignal) {
    return request<T>(path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value), signal,
    });
  }

  return {
    categories: () => request<Category[]>('/categories'),
    identify: (point: Point, signal: AbortSignal) => post<ParkMatch>('/park-match', point, signal),
    lookup: (reference: string, key: string) => post<Report>('/lookup', { reference, key }),
    create: async (input: ReportInput, photo: Photo | null, key: string) => {
      const form = new FormData();
      form.append('report', JSON.stringify(input));
      if (photo) {
        if (Platform.OS === 'web') {
          form.append('photo', photo.file ?? await (await fetch(photo.uri)).blob(), photo.name ?? 'evidencia.jpg');
        } else {
          // React Native's FormData accepts a file descriptor pointing to a local URI.
          const nativePart = { uri: photo.uri, name: photo.name ?? 'evidencia.jpg', type: photo.mimeType ?? 'image/jpeg' };
          form.append('photo', nativePart as unknown as Blob);
        }
      }
      return request<Report>('', { method: 'POST', headers: { 'X-Report-Key': key }, body: form });
    },
  };
}

export function readableError(error: unknown) {
  if (error instanceof Error && error.name !== 'TimeoutError' && error.name !== 'AbortError' && !(error instanceof TypeError)) {
    return error.message;
  }
  return 'No se pudo conectar con la API. Comprueba tu conexión e inténtalo de nuevo.';
}
