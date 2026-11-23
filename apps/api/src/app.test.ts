import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import sharp from 'sharp';
import { makeApp } from './app';
import { makeDashboardApp } from './dashboard';
import { openDatabase } from './database';

test('flujo ciudadano con PostGIS y protección de consulta', async (context) => {
  const previous = process.env.GEO_PROVIDER;
  const previousOrigins = process.env.WEB_ORIGINS;
  const lanOrigin = 'http://192.168.40.11:8081';
  process.env.GEO_PROVIDER = 'snapshot';
  process.env.WEB_ORIGINS = lanOrigin;
  const db = await openDatabase('', 'memory://');
  const app = await makeApp(db);
  const dashboard = await makeDashboardApp(db);
  context.after(async () => {
    if (previous === undefined) delete process.env.GEO_PROVIDER;
    else process.env.GEO_PROVIDER = previous;
    if (previousOrigins === undefined) delete process.env.WEB_ORIGINS;
    else process.env.WEB_ORIGINS = previousOrigins;
    await Promise.all([app.close(), dashboard.close()]);
    await db.close();
  });
  await app.listen(0, '127.0.0.1');
  await dashboard.listen(0, '127.0.0.1');
  const local = await dashboard.getUrl();
  const base = (await app.getUrl()) + '/api/v1/park-reports';
  const point = { latitude: 4.658, longitude: -74.093 };
  const key = randomUUID();
  const payload = { point, method: 'manual', detail: 'Sendero norte, poste L-07',
    category: 'lighting', description: 'El vidrio está quebrado y la luz no enciende.', risk: 'unsure' };

  const post = (path: string, body: unknown) =>
    fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const submit = (data: unknown, access: string, photo?: Blob) => {
    const body = new FormData();
    body.append('report', JSON.stringify(data));
    if (photo) body.append('photo', photo, 'foto.jpg');
    return fetch(base, { method: 'POST', headers: { 'X-Report-Key': access }, body });
  };

  for (const origin of ['http://localhost:8081', lanOrigin]) {
    const preflight = await fetch(base, {
      method: 'OPTIONS',
      headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'x-report-key' },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
  }
  const blocked = await fetch(base + '/categories', { headers: { Origin: 'http://unlisted.example' } });
  assert.equal(blocked.headers.get('access-control-allow-origin'), null);

  const categories = await fetch(base + '/categories');
  assert.equal((await categories.json()).length, 6);
  const match = await post('/park-match', point);
  assert.deepEqual(await match.json(), { source: 'snapshot', park: { name: 'Parque Simón Bolívar', locality: 'Teusaquillo' } });
  const outside = await post('/park-match', { latitude: 0, longitude: 0 });
  assert.equal((await outside.json()).park, null);
  assert.equal((await submit({ ...payload, point: { ...point, latitude: 91 } }, key)).status, 400);
  assert.equal((await submit({ ...payload, email: 'demo@example.com' }, key)).status, 400);
  assert.equal((await submit(payload, key, new Blob(['fake jpg'], { type: 'image/jpeg' }))).status, 400);

  const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'red' } }).png().toBuffer();
  const photo = new Blob([Uint8Array.from(png)], { type: 'image/png' });
  const [first, second] = await Promise.all([submit(payload, key, photo), submit(payload, key, photo)]);
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  const created = await first.json();
  assert.equal(created.reference, 'DEMO-1042');
  assert.deepEqual(await second.json(), created);
  assert.equal(created.status, 'pending_review');
  assert.equal((await submit({ ...payload, detail: 'Otro lugar' }, key, photo)).status, 409);

  const [saved] = await db.query<{ point: string; bytes: number; access_hash: string }>(
    'SELECT ST_AsText(location) AS point, octet_length(photo_jpeg) AS bytes, access_hash FROM park_reports.reports');
  assert.equal(saved.point, 'POINT(-74.093 4.658)');
  assert.ok(saved.bytes > 0);
  assert.notEqual(saved.access_hash, key);
  assert.equal((await post('/lookup', { reference: created.reference, key: randomUUID() })).status, 404);
  const found = await post('/lookup', { reference: created.reference, key });
  assert.equal(found.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await found.json(), created);
  assert.equal('description' in created || 'email' in created || 'point' in created, false);

  const ticketUrl = local + '/tickets/' + created.reference;
  assert.equal((await fetch(base + '/tickets/' + created.reference)).status, 404);
  assert.equal((await fetch(ticketUrl, { headers: { Origin: lanOrigin } })).status, 403);
  const panel = await fetch(local);
  assert.match(await panel.text(), /Gestión de reportes/);
  const queue = await fetch(local + '/tickets?q=Simón');
  const listed = await queue.json();
  assert.equal(listed.rows[0].reference, created.reference);
  assert.equal(listed.rows[0].hasPhoto, true);
  const evidence = await fetch(ticketUrl + '/photo');
  assert.equal(evidence.headers.get('content-type'), 'image/jpeg');
  assert.equal((await sharp(Buffer.from(await evidence.arrayBuffer())).metadata()).format, 'jpeg');

  const change = { version: 0, status: 'approved', priority: 'medium', publicNote: 'Programaremos la revisión de la luminaria.' };
  const update = (body: unknown, origin = local) => fetch(ticketUrl, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-SIGNU-Panel': '1', Origin: origin }, body: JSON.stringify(body),
  });
  assert.equal((await update(change, lanOrigin)).status, 403);
  assert.equal((await fetch(ticketUrl, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(change),
  })).status, 403);
  assert.equal((await update({ ...change, status: 'resolved' })).status, 409);
  assert.equal((await update({ ...change, status: 'rejected', publicNote: '' })).status, 400);
  const updates = await Promise.all([update(change), update(change)]);
  assert.deepEqual(updates.map((result) => result.status).sort(), [200, 409]);
  const current = await (await post('/lookup', { reference: created.reference, key })).json();
  assert.equal(current.status, 'approved');
  assert.equal(current.history.length, 2);
  assert.equal(current.history[1].publicNote, change.publicNote);
  assert.equal('priority' in current.history[1], false);
  assert.equal((await update({ ...change, version: 1, status: 'in_progress' })).status, 200);
  assert.equal((await update({ ...change, version: 2, status: 'resolved' })).status, 200);
  const resolved = await (await post('/lookup', { reference: created.reference, key })).json();
  assert.equal(resolved.status, 'resolved');
  assert.deepEqual(resolved.history.map((item: { status: string }) => item.status),
    ['pending_review', 'approved', 'in_progress', 'resolved']);
  assert.equal((await (await fetch(local + '/tickets?status=pending_review')).json()).rows.length, 0);
});
