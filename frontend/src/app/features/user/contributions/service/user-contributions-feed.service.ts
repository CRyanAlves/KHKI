import { Injectable, inject, signal } from '@angular/core';
import { UserContributionsApiService } from './user-contributions-api.service';
import { apiError } from '../../../../core/http/api-error';
import type { Contribution } from '../../../../domain/moderation/moderation.model';

@Injectable()
export class UserContributionsFeedService {
  private readonly contributions = inject(UserContributionsApiService);
  private requestPending = false;
  readonly items = signal<Contribution[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  async load(): Promise<void> {
    if (this.requestPending) return;
    this.loading.set(true);
    this.requestPending = true;
    this.error.set('');
    try {
      this.items.set(await this.contributions.list());
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.loading.set(false);
      this.requestPending = false;
    }
  }
}
