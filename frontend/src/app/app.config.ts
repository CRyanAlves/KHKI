import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withXsrfConfiguration } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
export const appConfig: ApplicationConfig = { providers: [{ provide: LOCALE_ID, useValue: 'pt-BR' }, provideBrowserGlobalErrorListeners(), provideHttpClient(withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' })), provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }))] };
