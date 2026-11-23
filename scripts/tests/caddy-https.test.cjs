// Real TLS routing check; uses disposable containers and no production database.
const { spawnSync } = require('node:child_process');
const https = require('node:https'), http = require('node:http');
const assert = require('node:assert/strict'), path = require('node:path');
const network = 'inventory-caddy-check-' + Date.now();
const containers = [];
function docker(args) {
  const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 60000 });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}
const pause = () => new Promise(resolve => setTimeout(resolve, 300));
async function retry(action) {
  let last;
  for (let i = 0; i < 30; i++) {
    try { return await action(); } catch (error) { last = error; await pause(); }
  }
  throw last;
}
function request(client, options) {
  return new Promise((resolve, reject) => {
    const req = client.get(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.setTimeout(5000, () => req.destroy(new Error('Request timed out')));
    req.on('error', reject);
  });
}
(async () => {
  try {
    docker(['network', 'create', network]);
    for (const [alias, port, text] of [['backend', 4000, 'api-ok'], ['frontend', 80, 'frontend-ok']]) {
      const name = network + '-' + alias;
      containers.push(name);
      docker(['run', '-d', '--rm', '--name', name, '--network', network, '--network-alias', alias,
        'node:24-alpine', 'node', '-e', `require('http').createServer((q,s)=>s.end('${text}')).listen(${port},'0.0.0.0')`]);
    }
    const name = network + '-proxy';
    containers.push(name);
    docker(['run', '-d', '--rm', '--name', name, '--network', network, '-e', 'SERVER_IP=127.0.0.1',
      '-p', '127.0.0.1::443', '-p', '127.0.0.1::80', '--mount',
      'type=bind,source=' + path.resolve(__dirname, '../../deploy/Caddyfile') + ',target=/etc/caddy/Caddyfile,readonly', process.env.CADDY_TEST_IMAGE||'inventory-audit-caddy:check']);
    const ports = JSON.parse(docker(['inspect', '--format', '{{json .NetworkSettings.Ports}}', name]));
    const tlsPort = Number(ports['443/tcp'][0].HostPort);
    const plainPort = Number(ports['80/tcp'][0].HostPort);
    const ca = await retry(() => docker(['exec', name, 'cat', '/data/caddy/pki/authorities/local/root.crt']));
    // Intentionally omit SNI, as clients connecting by IP commonly do.
    const api = await retry(() => request(https, { hostname: '127.0.0.1', port: tlsPort, path: '/api/v1/health', ca }));
    assert.equal(api.status, 200);
    assert.equal(api.body, 'api-ok');
    const home = await request(https, { hostname: '127.0.0.1', port: tlsPort, path: '/', ca });
    assert.equal(home.body, 'frontend-ok');
    const redirect = await request(http, { hostname: '127.0.0.1', port: plainPort, path: '/', headers: { Host: '127.0.0.1' } });
    assert.equal(redirect.status, 308);
    assert.ok(redirect.headers.location.startsWith('https://127.0.0.1'));
    docker(['exec', name, 'wget', '-q', '-O', '/dev/null', 'http://127.0.0.1:2019/config/']);
    console.log('PASS: real Caddy trusted HTTPS without SNI, API/frontend routing, HTTP redirect, and health command.');
  } finally {
    for (const name of containers.reverse()) spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore' });
    spawnSync('docker', ['network', 'rm', network], { stdio: 'ignore' });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
