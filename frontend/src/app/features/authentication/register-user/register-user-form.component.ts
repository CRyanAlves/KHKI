import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { AuthenticationForm } from '../forms/authentication-form';

@Component({ selector: 'app-register-user-form', imports: [FormsModule, IconComponent], templateUrl: '../forms/authentication-form.html', styleUrl: '../forms/authentication-form.scss' })
export class RegisterUserFormComponent extends AuthenticationForm {
  readonly register = true;

  protected authenticate(): Promise<void> {
    return this.auth.register(this.fields.name, this.fields.email, this.fields.password);
  }
}
