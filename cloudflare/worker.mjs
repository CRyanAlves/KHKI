const unavailable = () => Response.json({ status: 503, detail: 'A API está indisponível ou iniciando. Aguarde um momento e tente novamente.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });

function apiOrigin(environment) {
  let origin;
  try {
    origin = new URL(environment.API_ORIGIN);
  } catch {
    return null;
  }
  return origin.protocol === 'https:' && !origin.username && !origin.password && origin.pathname === '/' && !origin.search && !origin.hash ? origin : null;
}

export function isKeepAliveWindow(scheduledTime) {
  if (!Number.isFinite(scheduledTime)) return false;
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(new Date(scheduledTime)));
  return hour >= 7 && hour < 23;
}

export async function keepApiAwake(environment, scheduledTime, send = fetch) {
  if (!isKeepAliveWindow(scheduledTime)) return { skipped: true };
  const origin = apiOrigin(environment);
  if (!origin) throw new Error('Configuração da API indisponível para o agendamento.');
  let response;
  try {
    response = await send(new Request(new URL('/api/health', origin), { method: 'GET', headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'KHKI-KeepAlive' }, redirect: 'manual', signal: AbortSignal.timeout(90000) }));
  } catch {
    throw new Error('Não foi possível consultar a saúde da API no agendamento.');
  }
  await response.body?.cancel();
  if (!response.ok) throw new Error('A API não confirmou disponibilidade no agendamento: HTTP ' + response.status + '.');
  return { skipped: false, status: response.status };
}

export async function proxyApi(request, environment, send = fetch) {
  const origin = apiOrigin(environment);
  if (!origin) return unavailable();
  const url = new URL(request.url);
  const target = new URL(url.pathname + url.search, origin);
  const headers = new Headers(request.headers);
  headers.delete('Host');
  headers.delete('Forwarded');
  headers.delete('X-Forwarded-For');
  headers.set('X-Forwarded-Host', url.host);
  headers.set('X-Forwarded-Proto', 'https');
  const address = request.headers.get('CF-Connecting-IP');
  if (address) headers.set('X-Forwarded-For', address);
  try {
    const response = await send(new Request(target, { method: request.method, headers, body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body, redirect: 'manual', duplex: 'half' }));
    if ((response.headers.get('Content-Type') || '').includes('text/html')) return unavailable();
    const result = new Response(response.body, response);
    result.headers.set('Cache-Control', 'no-store');
    return result;
  } catch {
    return unavailable();
  }
}

export default {
  async scheduled(controller, environment) {
    const result = await keepApiAwake(environment, controller.scheduledTime);
    console.log(JSON.stringify({ event: 'api-keep-alive', ...result }));
  },
  async fetch(request, environment) {
    const path = new URL(request.url).pathname;
    return path === '/api' || path.startsWith('/api/') ? proxyApi(request, environment) : environment.ASSETS.fetch(request);
  }
};
