import { UserLoginService } from '../service/user-login.service';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { AuthenticationForm } from '../../../shared/forms/authentication/authentication-form';

@Component({ selector: 'app-login-form', imports: [FormsModule, IconComponent], templateUrl: '../../../shared/forms/authentication/authentication-form.html', styleUrl: '../../../shared/forms/authentication/authentication-form.scss' })
export class UserLoginFormComponent extends AuthenticationForm {
  private readonly login = inject(UserLoginService);
  readonly register = false;

  protected authenticate(): Promise<void> {
    return this.login.login(this.fields.email, this.fields.password, this.fields.rememberMe);
  }
}
