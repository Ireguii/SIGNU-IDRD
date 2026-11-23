const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

const mobile = resolve(__dirname, '../apps/mobile');
const api = resolve(__dirname, '../apps/api');
const fromMobile = createRequire(resolve(mobile, 'package.json'));
const fromApi = createRequire(resolve(api, 'package.json'));
const dist = resolve(mobile, 'dist');

function run(args, cwd, env) {
  const result = spawnSync(process.execPath, args, { cwd, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.signal === 'SIGINT') process.exit(0);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const buildEnv = { ...process.env, EXPO_PUBLIC_SAME_ORIGIN: '1', EXPO_PUBLIC_API_URL: '' };
run([fromMobile.resolve('expo/bin/cli'), 'export', '--platform', 'web', '--clear', '--max-workers', '2'], mobile, buildEnv);

for (const file of ['index.html', 'noticias.html', 'reportar-novedad.html']) {
  if (!existsSync(resolve(dist, file))) throw new Error(`Expo no generó dist/${file}.`);
}

run([
'--env-file-if-exists=.env', '--import', pathToFileURL(fromApi.resolve('tsx')).href, 'src/main.ts',], api, {
  ...process.env,
  HOST: '127.0.0.1',
  PORT: '8090',
  SIGNU_WEB_DIST: dist,
});
