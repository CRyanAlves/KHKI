import { CanDeactivateFn } from '@angular/router';
import type { BathroomRegistrationFormComponent } from '../view/bathroom-registration-form.component';

export const leaveBathroomRegistration: CanDeactivateFn<BathroomRegistrationFormComponent> = (component) => component.canLeave();
