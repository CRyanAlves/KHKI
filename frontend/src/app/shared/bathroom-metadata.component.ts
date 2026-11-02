import { Component, input } from '@angular/core';
import { BathroomDetails } from '../core/models';
import { bathroomDetailRows } from '../core/bathroom-details';
@Component({
  selector: 'app-bathroom-metadata',
  template: `@if (details(); as value) {
    <dl class="bathroom-metadata">
      @for (row of rows; track row.label) {
        <div>
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      }
    </dl>
  }`,
  styleUrl: './bathroom-metadata.component.scss'
})
export class BathroomMetadataComponent {
  readonly details = input<BathroomDetails | undefined>();
  get rows(): { label: string; value: string }[] {
    const details = this.details();
    return details ? bathroomDetailRows(details) : [];
  }
}
