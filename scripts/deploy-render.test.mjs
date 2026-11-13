import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deployRender, deploymentConfiguration } from './deploy-render.mjs';

const config = {RENDER_API_KEY: 'synthetic', RENDER_SERVICE_ID: 'srv-test', DEPLOY_COMMIT: 'a'.repeat(40),
  MIGRATION_DATABASE_URL: 'synthetic', CLOUDFLARE_API_TOKEN: 'synthetic', CLOUDFLARE_ACCOUNT_ID: 'synthetic',
  API_URL: 'https://api.example.invalid', STAGING_WEB_URL: 'https://app.example.invalid'};

function renderResponses(values) {
  const calls = [];
  return {calls, fetch: async (url, options) => {
    calls.push({url, options});
    const value = values.shift();
    assert.notEqual(value, undefined, 'Petición inesperada');
    return new Response(JSON.stringify(value), {status: 200});
  }};
}

test('OPS-01: no muta Render si el autodeploy puede sustituir el commit', async () => {
  const api = renderResponses([{autoDeploy: 'yes'}]);
  await assert.rejects(deployRender(config, api.fetch), /autoDeploy/);
  assert.equal(api.calls.length, 1);
});
test('OPS-01: fija SHA, espera live y después exige health', async () => {
  const api = renderResponses([{autoDeploy: 'no'}, {id: 'deploy-1'}, {status: 'build_in_progress'},
    {status: 'live', commit: {id: config.DEPLOY_COMMIT}}, {status: 'ok'}]);
  await deployRender(config, api.fetch, async () => {});
  assert.deepEqual(JSON.parse(api.calls[1].options.body), {commitId: config.DEPLOY_COMMIT});
  assert.equal(api.calls.at(-1).url, `${config.API_URL}/health`);
});
test('OPS-01: otro commit o fallo de build impide continuar al Worker', async () => {
  for (const deployment of [{status: 'live', commit: {id: 'b'.repeat(40)}}, {status: 'build_failed'}]) {
    const api = renderResponses([{autoDeploy: 'no'}, {id: 'deploy-1'}, deployment]);
    await assert.rejects(deployRender(config, api.fetch, async () => {}));
    assert.equal(api.calls.length, 3);
  }
});
test('OPS-01: preflight rechaza configuración ausente y orígenes inseguros sin revelar secretos', () => {
  assert.equal(deploymentConfiguration(config), config);
  assert.throws(() => deploymentConfiguration({...config, RENDER_API_KEY: ''}), /RENDER_API_KEY/);
  assert.throws(() => deploymentConfiguration({...config, API_URL: 'http://localhost:3001'}), /HTTPS/);
  assert.throws(() => deploymentConfiguration({...config, DEPLOY_COMMIT: 'develop'}), /SHA/);
});
