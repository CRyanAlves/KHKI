const http = require('node:http');
http
  .createServer((request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Content-Type', 'application/json');
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname.startsWith('/geoapify/')) url.pathname = url.pathname.slice('/geoapify'.length);
    const send = (status, body) => {
      response.statusCode = status;
      response.end(JSON.stringify(body));
    };
    if (request.method === 'OPTIONS') {
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      response.end();
      return;
    }
    if (url.pathname === '/health') {
      send(200, { status: 'UP', simulation: true });
      return;
    }
    if (['/v1/styles/positron/style.json', '/v1/styles/dark-matter/style.json'].includes(url.pathname)) {
      send(200, { version: 8, name: 'Estilo simulado para testes', sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': url.pathname.includes('dark-matter') ? '#101b22' : '#ecede8' } }] });
      return;
    }
    if (url.searchParams.get('apiKey') !== 'simulation-key') {
      send(403, { statusCode: 403, error: 'Forbidden', message: 'Invalid apiKey' });
      return;
    }
    if (url.pathname === '/v1/geocode/reverse') {
      const lat = Number(url.searchParams.get('lat')),
        lon = Number(url.searchParams.get('lon'));
      if (!url.searchParams.has('lat') || !url.searchParams.has('lon') || !Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180 || url.searchParams.get('format') !== 'json' || url.searchParams.get('lang') !== 'pt' || url.searchParams.get('limit') !== '1') {
        send(400, { message: 'Invalid reverse geocoding contract' });
        return;
      }
      const scenario = url.searchParams.get('simulationScenario');
      if (scenario === 'unavailable') {
        send(503, { message: 'Reverse geocoding unavailable' });
        return;
      }
      if (scenario === 'empty') {
        send(200, { results: [] });
        return;
      }
      const body = { results: [{ lat, lon, formatted: 'Rua da Posição, 100 — São Paulo, SP', country_code: 'br' }] };
      if (scenario === 'slow') setTimeout(() => send(200, body), 3000);
      else send(200, body);
      return;
    }
    if (url.pathname === '/v1/geocode/search' || url.pathname === '/v1/geocode/autocomplete') {
      const autocomplete = url.pathname.endsWith('/autocomplete');
      const text = url.searchParams.get('text') || '';
      if (url.searchParams.get('format') !== 'json' || url.searchParams.get('filter') !== 'countrycode:br' || url.searchParams.get('lang') !== 'pt' || url.searchParams.get('limit') !== (autocomplete ? '5' : '1') || !text) {
        send(400, { statusCode: 400, message: 'Invalid geocoding contract' });
        return;
      }
      if (text === 'limite') {
        send(429, { statusCode: 429, message: 'Rate limit exceeded' });
        return;
      }
      if (text === 'falha') {
        response.statusCode = 503;
        response.setHeader('Content-Type', 'text/html');
        response.end('<h1>Unavailable</h1>');
        return;
      }
      if (text === 'invalido') {
        send(200, { results: [{ lat: 999, lon: -46.65 }] });
        return;
      }
      if (text === 'sem resultado') {
        send(200, { results: [] });
        return;
      }
      const results = autocomplete
        ? [
            { lat: -23.556, lon: -46.658, formatted: text, address_line2: 'São Paulo — SP', country_code: 'br' },
            { lat: -23.558, lon: -46.659, formatted: text + ' — alternativa', address_line2: 'São Paulo — SP', country_code: 'br' }
          ]
        : [{ lat: -23.556, lon: -46.658, formatted: 'Endereço simulado — São Paulo, Brasil', country_code: 'br' }];
      if (text === 'lento') setTimeout(() => send(200, { results, query: { text } }), 1200);
      else send(200, { results, query: { text } });
      return;
    }
    if (url.pathname === '/v1/routing') {
      if (url.searchParams.get('simulationScenario') === 'unavailable') {
        send(503, { statusCode: 503, message: 'Routing temporarily unavailable' });
        return;
      }
      const waypoints = (url.searchParams.get('waypoints') || '').split('|').map((value) => value.split(',').map(Number));
      if (
        !['walk', 'drive', 'bicycle', 'motorcycle'].includes(url.searchParams.get('mode')) ||
        url.searchParams.get('units') !== 'metric' ||
        url.searchParams.get('format') !== 'geojson' ||
        url.searchParams.get('lang') !== 'pt-BR' ||
        url.searchParams.get('details') !== 'instruction_details' ||
        waypoints.length !== 2 ||
        waypoints.some((point) => point.length !== 2 || !Number.isFinite(point[0]) || !Number.isFinite(point[1]))
      ) {
        send(400, { statusCode: 400, message: 'Invalid routing contract' });
        return;
      }
      const mode = url.searchParams.get('mode');
      const distance = { drive: 1100, motorcycle: 1000, bicycle: 700, walk: 300 }[mode];
      const time = url.searchParams.get('simulationScenario') === 'long' ? 3900 : { drive: 180, motorcycle: 160, bicycle: 210, walk: 240 }[mode];
      const coordinates = waypoints.map((point) => [point[1], point[0]]);
      if (mode === 'drive') coordinates.splice(1, 0, [coordinates[0][0] - 0.002, coordinates[0][1]], [coordinates[0][0] - 0.002, coordinates[1][1]]);
      const steps = coordinates.map((point, index) => ({
        from_index: index,
        to_index: Math.min(index + 1, coordinates.length - 1),
        instruction: {
          type: index === 0 ? 'StartAt' : index === coordinates.length - 1 ? 'DestinationReached' : index === 1 ? 'Left' : 'Right',
          text: index === 0 ? (mode === 'drive' ? 'Contorne o quarteirão seguindo o sentido permitido da via simulada.' : 'Siga pela rua de teste até o destino.') : index === coordinates.length - 1 ? 'Chegue ao destino de teste.' : index === 1 ? 'Vire à esquerda na rua de teste.' : 'Vire à direita na avenida de teste.'
        }
      }));
      const result = {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: { type: 'MultiLineString', coordinates: [coordinates] }, properties: { mode, distance, distance_units: 'Meters', time, legs: [{ distance, time, steps }] } }]
      };
      if (url.searchParams.get('simulationScenario') === 'slow') setTimeout(() => send(200, result), 1500);
      else send(200, result);
      return;
    }
    send(501, { message: 'Endpoint não modelado nesta simulação.' });
  })
  .listen(4900, '127.0.0.1');
