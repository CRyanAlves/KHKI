import { UserRegistrationService } from '../service/user-registration.service';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { AuthenticationForm } from '../../../../shared/forms/authentication/authentication-form';

@Component({ selector: 'app-register-user-form', imports: [FormsModule, IconComponent], templateUrl: '../../../../shared/forms/authentication/authentication-form.html', styleUrl: '../../../../shared/forms/authentication/authentication-form.scss' })
export class UserRegistrationFormComponent extends AuthenticationForm {
  private readonly users = inject(UserRegistrationService);
  readonly register = true;

  protected authenticate(): Promise<void> {
    return this.users.register(this.fields.name, this.fields.email, this.fields.password);
  }
}
