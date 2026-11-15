import { CanDeactivateFn } from '@angular/router';
import type { RegisterBathroomComponent } from './register-bathroom.component';

export const leaveRegistration: CanDeactivateFn<RegisterBathroomComponent> = (component) => component.canLeave();
