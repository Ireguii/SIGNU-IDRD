import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { postgis } from '@electric-sql/pglite-postgis';
import { Pool } from 'pg';

export interface Database {
  query<T extends Record<string, unknown>>(sql: string, values?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
}

export async function openDatabase(url = process.env.DATABASE_URL, directory = '.signu-data/db'): Promise<Database> {
  const schema = await readFile(resolve(__dirname, '../sql/schema.sql'), 'utf8');
  const snapshot = JSON.parse(await readFile(resolve(__dirname, '../data/parks.geojson'), 'utf8')) as {
    features: Array<{ properties: { id: string; name: string; locality: string }; geometry: unknown }>;
  };

  let db: Database;
  let migrate: () => Promise<unknown>;
  if (url) {
    const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 5000 });
    db = {
      query: async <T extends Record<string, unknown>>(sql: string, values?: unknown[]) =>
        (await pool.query<T>(sql, values)).rows,
      close: () => pool.end(),
    };
    migrate = () => pool.query(schema);
  } else {
    if (directory !== 'memory://') await mkdir(dirname(resolve(directory)), { recursive: true });
    const local = new PGlite(directory, { extensions: { postgis } });
    db = {
      query: async <T extends Record<string, unknown>>(sql: string, values?: unknown[]) =>
        (await local.query<T>(sql, values)).rows,
      close: () => local.close(),
    };
    migrate = () => local.exec(schema);
  }

  try {
    await migrate();
    for (const { properties, geometry } of snapshot.features) {
      await db.query(`INSERT INTO park_reports.demo_parks (id, name, locality, boundary)
        VALUES ($1, $2, $3, ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($4), 4326)))
        ON CONFLICT (id) DO NOTHING`, [properties.id, properties.name, properties.locality, JSON.stringify(geometry)]);
    }
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}
