const http = require('node:http');
http.createServer((request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Content-Type', 'application/json');
  const url = new URL(request.url, 'http://localhost');
    if (url.pathname.startsWith('/geoapify/')) url.pathname = url.pathname.slice('/geoapify'.length);
  const send = (status, body) => { response.statusCode = status; response.end(JSON.stringify(body)); };
  if (request.method === 'OPTIONS') { response.setHeader('Access-Control-Allow-Headers', 'Content-Type'); response.end(); return; }
  if (url.pathname === '/health') { send(200, { status: 'UP', simulation: true }); return; }
  if (['/v1/styles/positron/style.json', '/v1/styles/dark-matter/style.json'].includes(url.pathname)) { send(200, { version: 8, name: 'Estilo simulado para testes', sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': url.pathname.includes('dark-matter') ? '#101b22' : '#ecede8' } }] }); return; }
  if (url.searchParams.get('apiKey') !== 'simulation-key') { send(403, { statusCode: 403, error: 'Forbidden', message: 'Invalid apiKey' }); return; }
  if (url.pathname === '/v1/geocode/search') {
    const text = url.searchParams.get('text') || '';
    if (url.searchParams.get('format') !== 'json' || url.searchParams.get('filter') !== 'countrycode:br' || url.searchParams.get('lang') !== 'pt' || url.searchParams.get('limit') !== '1' || !text) { send(400, { statusCode: 400, message: 'Invalid geocoding contract' }); return; }
    if (text === 'limite') { send(429, { statusCode: 429, message: 'Rate limit exceeded' }); return; }
    if (text === 'falha') { response.statusCode = 503; response.setHeader('Content-Type', 'text/html'); response.end('<h1>Unavailable</h1>'); return; }
    if (text === 'invalido') { send(200, { results: [{ lat: 999, lon: -46.65 }] }); return; }
    if (text === 'sem resultado') { send(200, { results: [] }); return; }
    send(200, { results: [{ lat: -23.556, lon: -46.658, formatted: 'Endereço simulado — São Paulo, Brasil', country_code: 'br' }], query: { text } }); return;
  }
  if (url.pathname === '/v1/routing') {
    const waypoints = (url.searchParams.get('waypoints') || '').split('|').map(value => value.split(',').map(Number));
    if (!['walk', 'drive'].includes(url.searchParams.get('mode')) || url.searchParams.get('units') !== 'metric' || url.searchParams.get('format') !== 'geojson' || url.searchParams.get('lang') !== 'pt-BR' || waypoints.length !== 2 || waypoints.some(point => point.length !== 2 || !Number.isFinite(point[0]) || !Number.isFinite(point[1]))) { send(400, { statusCode: 400, message: 'Invalid routing contract' }); return; }
    const mode = url.searchParams.get('mode'); const distance = mode === 'drive' ? 1100 : 300; const time = mode === 'drive' ? 180 : 240;
    const coordinates = waypoints.map(point => [point[1], point[0]]);
    if (mode === 'drive') coordinates.splice(1, 0, [coordinates[0][0] - 0.002, coordinates[0][1]], [coordinates[0][0] - 0.002, coordinates[1][1]]);
    send(200, { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'MultiLineString', coordinates: [coordinates] }, properties: { mode, distance, distance_units: 'Meters', time, legs: [{ distance, time, steps: [{ instruction: { text: mode === 'drive' ? 'Contorne o quarteirão seguindo o sentido permitido da via simulada.' : 'Siga pela rua de teste até o destino.' } }] }] } }] }); return;
  }
  send(501, { message: 'Endpoint não modelado nesta simulação.' });
}).listen(4900, '127.0.0.1');
