import { ContentReportSubmissionService } from '../service/content-report-submission.service';
import type { ContentReportTarget } from '../model/content-report-target.model';
import { Component, EventEmitter, Input, OnInit, Output, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/session/auth.service';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { DialogFocusDirective } from '../../../shared/directives/dialog-focus.directive';

@Component({
  selector: 'app-report',
  providers: [ContentReportSubmissionService],
  imports: [FormsModule, IconComponent, DialogFocusDirective],
  templateUrl: './content-report-form.component.html'
})
export class ContentReportFormComponent implements OnInit {
  readonly submission = inject(ContentReportSubmissionService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private awaitingLogin = false;
  @Input({ required: true }) target!: ContentReportTarget;
  @Output() closed = new EventEmitter<void>();
  constructor() {
    effect(() => {
      const loginOpened = this.auth.opened();
      const user = this.auth.user();
      if (!this.awaitingLogin || loginOpened) return;
      this.awaitingLogin = false;
      if (!user) this.closed.emit();
    });
  }
  ngOnInit(): void {
    this.awaitingLogin = !this.auth.require(this.router.url);
  }
  async submit(): Promise<void> {
    if (this.submission.busy() || this.submission.sent()) return;
    if (!this.auth.require(this.router.url)) {
      this.awaitingLogin = true;
      return;
    }
    await this.submission.submit(this.target);
  }
}
