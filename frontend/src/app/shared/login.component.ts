import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ThemeService } from '../core/theme.service';
import { AuthService } from '../core/auth.service';
import { ApiService } from '../core/api.service';
import { IconComponent } from './icon.component';
import { DialogFocusDirective } from './dialog-focus.directive';

@Component({ selector: 'app-login', imports: [FormsModule, IconComponent, DialogFocusDirective], templateUrl: './login.component.html' })
export class LoginComponent {
  private readonly changeDetector = inject(ChangeDetectorRef);
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  private readonly api = inject(ApiService);
  register = false;
  visible = false;
  name = '';
  email = '';
  password = '';
  error = '';
  busy = false;
  close(): void {
    if (!this.busy) this.auth.opened.set(false);
  }
  async submit(): Promise<void> {
    this.busy = true;
    this.error = '';
    try {
      if (this.register) await this.auth.register(this.name, this.email, this.password);
      else await this.auth.login(this.email, this.password);
    } catch (error) {
      this.error = this.api.error(error);
    } finally {
      this.changeDetector.markForCheck();
      this.busy = false;
    }
  }
}
