import { Routes } from '@angular/router';
import { authenticated, administrator } from './core/session/auth.guards';
import { leaveRegistration } from './features/register-bathroom/leave-registration.guard';

export const routes: Routes = [
  { path: 'contribuicoes', canActivate: [authenticated], loadComponent: () => import('./features/my-contributions/contributions.component').then((module) => module.ContributionsComponent), title: 'Minhas contribuições · KHKI' },
  { path: 'admin', canActivate: [administrator], loadComponent: () => import('./features/moderation/admin.component').then((module) => module.AdminComponent), title: 'Moderação · KHKI' },
  {
    path: '',
    loadComponent: () => import('./layout/exploration-workspace/workspace.component').then((module) => module.WorkspaceComponent),
    children: [
      { path: 'cadastrar', canActivate: [authenticated], canDeactivate: [leaveRegistration], loadComponent: () => import('./features/register-bathroom/register-bathroom.component').then((module) => module.RegisterBathroomComponent), title: 'Cadastrar banheiro · KHKI' },
      { path: '', pathMatch: 'full', loadComponent: () => import('./features/explore-bathrooms/search-state.component').then((module) => module.SearchStateComponent), title: 'KHKI · Encontre seu próximo alívio' },
      { path: 'banheiros/:id/avaliar', canActivate: [authenticated], loadComponent: () => import('./features/review-bathroom/review.component').then((module) => module.ReviewComponent), title: 'Avaliar banheiro · KHKI' },
      { path: 'banheiros/:id/fotos', redirectTo: 'banheiros/:id/avaliar', pathMatch: 'full' },
      { path: 'banheiros/:id/rota', loadComponent: () => import('./features/plan-route/route.component').then((module) => module.RouteComponent), title: 'Como chegar · KHKI' },
      { path: 'banheiros/:id', loadComponent: () => import('./features/bathroom-details/details.component').then((module) => module.DetailsComponent), title: 'Detalhes do banheiro · KHKI' }
    ]
  },
  { path: '**', redirectTo: '' }
];
