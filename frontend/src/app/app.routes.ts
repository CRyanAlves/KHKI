import { inject } from '@angular/core';
import { CanActivateFn, CanDeactivateFn, Router, Routes } from '@angular/router';
import type { RegisterComponent } from './features/register/register.component';
import { AuthService } from './core/auth.service';
const authenticated: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ready;
  return auth.require(state.url) || (router.navigated ? false : router.createUrlTree(['/']));
};
const administrator: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ready;
  return auth.user()?.role === 'ADMIN' || router.createUrlTree(['/']);
};
const leaveRegistration: CanDeactivateFn<RegisterComponent> = (component) => component.canLeave();
export const routes: Routes = [
  { path: 'contribuicoes', canActivate: [authenticated], loadComponent: () => import('./features/contributions/contributions.component').then((module) => module.ContributionsComponent), title: 'Minhas contribuições · KHKI' },
  { path: 'admin', canActivate: [administrator], loadComponent: () => import('./features/admin/admin.component').then((module) => module.AdminComponent), title: 'Moderação · KHKI' },
  {
    path: '',
    loadComponent: () => import('./features/workspace/workspace.component').then((module) => module.WorkspaceComponent),
    children: [
      { path: 'cadastrar', canActivate: [authenticated], canDeactivate: [leaveRegistration], loadComponent: () => import('./features/register/register.component').then((module) => module.RegisterComponent), title: 'Cadastrar banheiro · KHKI' },
      { path: '', pathMatch: 'full', loadComponent: () => import('./features/explore/search-state.component').then((module) => module.SearchStateComponent), title: 'KHKI · Encontre seu próximo alívio' },
      { path: 'banheiros/:id/avaliar', canActivate: [authenticated], loadComponent: () => import('./features/review/review.component').then((module) => module.ReviewComponent), title: 'Avaliar banheiro · KHKI' },
      { path: 'banheiros/:id/fotos', canActivate: [authenticated], loadComponent: () => import('./features/photos/photos.component').then((module) => module.PhotosComponent), title: 'Enviar foto · KHKI' },
      { path: 'banheiros/:id/rota', loadComponent: () => import('./features/route/route.component').then((module) => module.RouteComponent), title: 'Como chegar · KHKI' },
      { path: 'banheiros/:id', loadComponent: () => import('./features/details/details.component').then((module) => module.DetailsComponent), title: 'Detalhes do banheiro · KHKI' }
    ]
  },
  { path: '**', redirectTo: '' }
];
