import { pathToFileURL } from 'node:url';

export function deploymentConfiguration(env) {
  const required = ['RENDER_API_KEY', 'RENDER_SERVICE_ID', 'DEPLOY_COMMIT', 'MIGRATION_DATABASE_URL',
    'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'API_URL', 'STAGING_WEB_URL'];
  const missing = required.filter(key => !env[key]?.trim());
  if (missing.length) throw new Error(`Configuración de staging incompleta: ${missing.join(', ')}`);
  if (!/^[a-f0-9]{40}$/.test(env.DEPLOY_COMMIT)) throw new Error('DEPLOY_COMMIT debe ser un SHA completo');
  for (const key of ['API_URL', 'STAGING_WEB_URL']) {
    const url = new URL(env[key]);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error(`${key} debe ser un origen HTTPS sin credenciales`);
    }
  }
  return env;
}

export async function checkEndpoint(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, {signal: AbortSignal.timeout(30_000)});
  if (!response.ok) throw new Error(`La comprobación operativa falló (HTTP ${response.status})`);
}

export async function checkRenderService(config, fetchImpl = fetch) {
  const response = await fetchImpl(`https://api.render.com/v1/services/${encodeURIComponent(config.RENDER_SERVICE_ID)}`, {
    headers: {Authorization: `Bearer ${config.RENDER_API_KEY}`}, signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Render rechazó la comprobación previa (HTTP ${response.status})`);
  const service = await response.json();
  if (service.autoDeploy !== 'no') throw new Error('Render debe tener autoDeploy desactivado antes de promover commits');
}

export async function deployRender(config, fetchImpl = fetch, pause = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  const serviceUrl = `https://api.render.com/v1/services/${encodeURIComponent(config.RENDER_SERVICE_ID)}`;
  const headers = {Authorization: `Bearer ${config.RENDER_API_KEY}`, 'Content-Type': 'application/json'};
  async function request(url, options = {}) {
    const response = await fetchImpl(url, {...options, headers, signal: AbortSignal.timeout(30_000)});
    if (!response.ok) throw new Error(`Render rechazó la operación (HTTP ${response.status})`);
    return response.json();
  }
  await checkRenderService(config, fetchImpl);
  const created = await request(`${serviceUrl}/deploys`, {method: 'POST', body: JSON.stringify({commitId: config.DEPLOY_COMMIT})});
  if (typeof created.id !== 'string') throw new Error('Render no devolvió un identificador de despliegue');
  for (let poll = 0; poll < 120; poll++) {
    const deployment = await request(`${serviceUrl}/deploys/${encodeURIComponent(created.id)}`);
    if (deployment.status === 'live') {
      if (deployment.commit?.id !== config.DEPLOY_COMMIT) throw new Error('Render publicó otro commit');
      await checkEndpoint(`${config.API_URL.replace(/\/$/, '')}/health`, fetchImpl);
      console.log(`API publicada y saludable desde ${config.DEPLOY_COMMIT}`);
      return;
    }
    if (typeof deployment.status !== 'string' || /failed|canceled|deactivated/.test(deployment.status)) {
      throw new Error('El despliegue de Render no llegó a live');
    }
    await pause(10_000);
  }
  throw new Error('El despliegue de Render excedió 20 minutos; revisar antes de reintentar');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const config = deploymentConfiguration(process.env);
    if (process.argv.includes('--check-web')) await checkEndpoint(`${config.STAGING_WEB_URL.replace(/\/$/, '')}/login`);
    else if (process.argv.includes('--check')) await checkRenderService(config);
    else await deployRender(config);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Falló la promoción a staging');
    process.exitCode = 1;
  }
}
