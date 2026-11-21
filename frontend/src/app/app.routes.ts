import { Routes } from '@angular/router';
import { authenticated, administrator } from './core/session/auth.guards';
import { leaveBathroomRegistration } from './features/bathroom/register/service/leave-bathroom-registration.guard';

export const routes: Routes = [
  { path: 'contribuicoes', canActivate: [authenticated], loadComponent: () => import('./features/user/contributions/view/page/user-contributions-page.component').then((module) => module.UserContributionsPageComponent), title: 'Minhas contribuições · KHKI' },
  { path: 'admin', canActivate: [administrator], loadComponent: () => import('./features/moderation/view/content-moderation-panel.component').then((module) => module.ContentModerationPanelComponent), title: 'Moderação · KHKI' },
  {
    path: '',
    loadComponent: () => import('./layout/exploration-workspace/workspace.component').then((module) => module.WorkspaceComponent),
    children: [
      { path: 'cadastrar', canActivate: [authenticated], canDeactivate: [leaveBathroomRegistration], loadComponent: () => import('./features/bathroom/register/view/bathroom-registration-form.component').then((module) => module.BathroomRegistrationFormComponent), title: 'Cadastrar banheiro · KHKI' },
      { path: '', pathMatch: 'full', loadComponent: () => import('./features/bathroom/search/view/bathroom-search-entry.component').then((module) => module.BathroomSearchEntryComponent), title: 'KHKI · Encontre seu próximo alívio' },
      { path: 'banheiros/:id/avaliar', canActivate: [authenticated], loadComponent: () => import('./features/review/view/bathroom-review-form.component').then((module) => module.BathroomReviewFormComponent), title: 'Avaliar banheiro · KHKI' },
      { path: 'banheiros/:id/fotos', redirectTo: 'banheiros/:id/avaliar', pathMatch: 'full' },
      { path: 'banheiros/:id/rota', loadComponent: () => import('./features/route/planning/view/route-planning.component').then((module) => module.RoutePlanningComponent), title: 'Como chegar · KHKI' },
      { path: 'banheiros/:id', loadComponent: () => import('./features/bathroom/details/view/panel/bathroom-details-panel.component').then((module) => module.BathroomDetailsPanelComponent), title: 'Detalhes do banheiro · KHKI' }
    ]
  },
  { path: '**', redirectTo: '' }
];
