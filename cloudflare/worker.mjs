const unavailable = () => Response.json({ status: 503, detail: 'A API está indisponível ou iniciando. Aguarde um momento e tente novamente.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });

export async function proxyApi(request, environment, send = fetch) {
  let origin;
  try { origin = new URL(environment.API_ORIGIN); } catch { return unavailable(); }
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) return unavailable();
  const url = new URL(request.url); const target = new URL(url.pathname + url.search, origin);
  const headers = new Headers(request.headers);
  headers.delete('Host'); headers.delete('Forwarded'); headers.delete('X-Forwarded-For');
  headers.set('X-Forwarded-Host', url.host); headers.set('X-Forwarded-Proto', 'https');
  const address = request.headers.get('CF-Connecting-IP'); if (address) headers.set('X-Forwarded-For', address);
  try {
    const response = await send(new Request(target, { method: request.method, headers, body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body, redirect: 'manual', duplex: 'half' }));
    if ((response.headers.get('Content-Type') || '').includes('text/html')) return unavailable();
    const result = new Response(response.body, response); result.headers.set('Cache-Control', 'no-store'); return result;
  } catch { return unavailable(); }
}

export default {
  async fetch(request, environment) {
    const path = new URL(request.url).pathname;
    return path === '/api' || path.startsWith('/api/') ? proxyApi(request, environment) : environment.ASSETS.fetch(request);
  }
};