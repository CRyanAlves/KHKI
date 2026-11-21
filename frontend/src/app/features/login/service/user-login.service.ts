import type { UserLoginRequest } from '../model/user-login-request.model';
import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../core/http/api.service';
import { AuthService } from '../../../core/session/auth.service';
import { User } from '../../../domain/users/user.model';

@Injectable({ providedIn: 'root' })
export class UserLoginService {
  private readonly api = inject(ApiService);
  private readonly session = inject(AuthService);

  async login(email: string, password: string, rememberMe = false): Promise<void> {
    await this.api.get('/auth/csrf');
    const credentials: UserLoginRequest = { email, password, rememberMe };
    const user = await this.api.post<User>('/auth/login', credentials);
    await this.session.completeLogin(user);
  }
}
