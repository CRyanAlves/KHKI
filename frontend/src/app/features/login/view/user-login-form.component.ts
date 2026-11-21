import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { AuthenticationForm } from '../../../shared/forms/authentication/authentication-form';

@Component({ selector: 'app-login-form', imports: [FormsModule, IconComponent], templateUrl: '../../../shared/forms/authentication/authentication-form.html', styleUrl: '../../../shared/forms/authentication/authentication-form.scss' })
export class LoginFormComponent extends AuthenticationForm {
  readonly register = false;

  protected authenticate(): Promise<void> {
    return this.auth.login(this.fields.email, this.fields.password, this.fields.rememberMe);
  }
}
