import { CanDeactivateFn } from '@angular/router';
import type { RegisterBathroomComponent } from '../view/bathroom-registration-form.component';

export const leaveRegistration: CanDeactivateFn<RegisterBathroomComponent> = (component) => component.canLeave();
