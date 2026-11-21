import { UserContributionsFeedService } from '../../service/user-contributions-feed.service';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { STATUS_LABELS } from '../../../../../domain/moderation/moderation.model';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';

import { MobileUiService } from '../../../../../layout/mobile/mobile-ui.service';
import { MobileUserContributionsListComponent } from '../list/mobile-user-contributions-list.component';
import { SkeletonComponent } from '../../../../../shared/ui/skeleton/skeleton.component';

@Component({
  selector: 'app-contributions',
  providers: [UserContributionsFeedService],
  imports: [MobileUserContributionsListComponent, SkeletonComponent, RouterLink, DatePipe, IconComponent],
  templateUrl: './user-contributions-page.component.html'
})
export class UserContributionsPageComponent implements OnInit {
  readonly feed = inject(UserContributionsFeedService);
  readonly mobileUi = inject(MobileUiService);
  readonly labels = STATUS_LABELS;
  ngOnInit(): void {
    void this.feed.load();
  }
}
