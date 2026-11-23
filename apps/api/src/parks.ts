import { Inject, Injectable } from '@nestjs/common';
import type { Coordinates } from './contracts';
import type { Database } from './database';

export const DATABASE = Symbol('database');
const layer = 'https://serviciosgis.catastrobogota.gov.co/arcgis/rest/services/recreaciondeporte/parquesyescenarios/MapServer/1';

export type ParkMatch = {
  source: 'public' | 'snapshot';
  park: { name: string; locality: string } | null;
};

function displayName(name: string) {
  const names: Record<string, string> = {
    'Simon Bolivar ( Sector Central )': 'Parque Simón Bolívar',
    'Simon Bolivar ( Sector Parque De Los Novios )': 'Parque de los Novios',
    'El Tunal': 'Parque El Tunal',
  };
  return names[name] ?? name;
}

@Injectable()
export class ParksService {
  private readonly cache = new Map<string, { value: ParkMatch; expires: number }>();

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async identify(point: Coordinates): Promise<ParkMatch> {
    const key = [point.latitude, point.longitude].join(',');
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.value;

    let value: ParkMatch;
    try {
      value = process.env.GEO_PROVIDER === 'snapshot' ? await this.local(point) : await this.remote(point);
    } catch {
      value = await this.local(point);
    }

    if (this.cache.size >= 500) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(key, { value, expires: Date.now() + (value.source === 'public' ? 300_000 : 20_000) });
    return value;
  }

  private async remote(point: Coordinates): Promise<ParkMatch> {
    const params = new URLSearchParams({
      where: '1=1',
      geometry: `${point.longitude},${point.latitude}`,
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'NOMBREPAR,LOCNOMBRE',
      returnGeometry: 'false',
      orderByFields: 'OBJECTID ASC',
      resultRecordCount: '1',
      f: 'json',
    });

    const response = await fetch(`${layer}/query?${params}`, { signal: AbortSignal.timeout(6500) });
    if (!response.ok) throw new Error('Servicio geográfico no disponible');
    const result = await response.json() as { features?: Array<{ attributes: { NOMBREPAR?: string; LOCNOMBRE?: string } }> };
    if (!Array.isArray(result.features)) throw new Error('Respuesta geográfica inválida');
    const attrs = result.features[0]?.attributes;
    const park = attrs?.NOMBREPAR ? { name: displayName(attrs.NOMBREPAR), locality: (attrs.LOCNOMBRE ?? '').toLocaleLowerCase('es-CO').replace(/\b\w/g, (letter) => letter.toUpperCase()) } : null;
    return { source: 'public', park };
  }

  private async local({ longitude, latitude }: Coordinates): Promise<ParkMatch> {
    const [park] = await this.db.query<{ name: string; locality: string }>(`SELECT name, locality
      FROM park_reports.demo_parks
      WHERE ST_Covers(boundary, ST_SetSRID(ST_MakePoint($1, $2), 4326))
      ORDER BY ST_Area(boundary), id LIMIT 1`, [longitude, latitude]);
    return { source: 'snapshot', park: park ?? null };
  }
}
