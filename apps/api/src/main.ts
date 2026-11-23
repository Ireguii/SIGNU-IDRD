import { makeApp } from './app';
import { makeDashboardApp } from './dashboard';
import { openDatabase } from './database';

async function main() {
  const db = await openDatabase();
  const webDist = process.env.SIGNU_WEB_DIST;
  const app = await makeApp(db, webDist);
  const dashboard = await makeDashboardApp(db);
  const port = Number(process.env.PORT ?? 3100);
  const panelPort = Number(process.env.DASHBOARD_PORT ?? 3101);
  try {
    await dashboard.listen(panelPort, '127.0.0.1');
    await app.listen(port, process.env.HOST ?? '0.0.0.0');
  } catch (error) {
    await Promise.allSettled([app.close(), dashboard.close()]);
    await db.close();
    throw error;
  }
  if (webDist) console.log(`SIGNU demo · Web y API en http://127.0.0.1:${port}/`);
  else console.log(`SIGNU demo · API en el puerto ${port}`);
  console.log(`SIGNU demo · Panel local en http://127.0.0.1:${panelPort}`);
  const shutdown = async () => {
    await Promise.all([app.close(), dashboard.close()]);
    await db.close();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch((error: unknown) => {
  console.error('No se pudo iniciar SIGNU-IDRD.', error);
  process.exitCode = 1;
});
