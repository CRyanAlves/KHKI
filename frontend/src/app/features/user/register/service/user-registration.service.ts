import type { UserRegistrationRequest } from '../model/user-registration-request.model';
import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../../core/http/api.service';
import { UserLoginService } from '../../../login/service/user-login.service';

@Injectable({ providedIn: 'root' })
export class UserRegistrationService {
  private readonly api = inject(ApiService);
  private readonly login = inject(UserLoginService);

  async register(name: string, email: string, password: string): Promise<void> {
    await this.api.get('/auth/csrf');
    const registration: UserRegistrationRequest = { name, email, password };
    await this.api.post('/auth/register', registration);
    await this.login.login(email, password);
  }
}
