import { expect, test } from '@playwright/test';
import { jsonObject } from '../src/app/shared/utils/json-object';
import { distanceMeters, validPoint } from '../src/app/shared/geo/navigation-geometry';

test('Rejeita formatos JSON inválidos no leitor compartilhado sem inventar campos', () => {
  for (const value of [null, undefined, [], 'text', 7, true]) expect(jsonObject(value)).toEqual({});
  const response = { features: [], message: 'Resposta do serviço' };
  expect(jsonObject(response)).toBe(response);
});

test('Usa coordenadas e distâncias compartilhadas de forma consistente no cadastro, nos filtros e na navegação', () => {
  expect(validPoint({ lat: -23.1, lng: -47.2 })).toBe(true);
  for (const point of [
    { lat: NaN, lng: 0 },
    { lat: 91, lng: 0 },
    { lat: 0, lng: 181 },
    { lat: 0, lng: Infinity }
  ])
    expect(validPoint(point)).toBe(false);
  expect(distanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 0.001 })).toBeCloseTo(111.1949, 3);
  expect(Number.isFinite(distanceMeters({ lat: 45, lng: 0 }, { lat: -45, lng: 180 }))).toBe(true);
});
