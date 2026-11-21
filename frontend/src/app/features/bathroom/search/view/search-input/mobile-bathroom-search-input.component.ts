import { BathroomSearchSuggestionsService } from '../../service/bathroom-search-suggestions.service';
import { Component, ElementRef, HostListener, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MobileUiService } from '../../../../../layout/mobile/mobile-ui.service';
import { ExplorationState } from '../../../../../layout/exploration-workspace/exploration-state.service';
import { AccountAvatarComponent } from '../../../../../shared/ui/account-avatar/account-avatar.component';
import { BathroomSearchFiltersBarComponent } from '../filters/bathroom-search-filters-bar.component';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';

@Component({ selector: 'app-mobile-search', providers: [BathroomSearchSuggestionsService], imports: [BathroomSearchFiltersBarComponent, FormsModule, IconComponent, AccountAvatarComponent], templateUrl: './mobile-bathroom-search-input.component.html' })
export class MobileBathroomSearchInputComponent {
  readonly areaSearchAvailable = input(false);
  readonly areaSearchRequested = output<void>();
  readonly ui = inject(MobileUiService);
  readonly state = inject(ExplorationState);
  private readonly router = inject(Router);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly suggestions = inject(BathroomSearchSuggestionsService);
  activeIndex = -1;
  focus(): void {
    this.ui.searchOpen.set(true);
    this.edit();
  }
  edit(): void {
    this.activeIndex = -1;
    this.suggestions.search(this.state.query, this.state.position());
  }
  async choose(index: number): Promise<void> {
    const suggestion = this.suggestions.items()[index];
    if (!suggestion) return;
    this.close();
    if (suggestion.bathroom) await this.router.navigate(['/banheiros', suggestion.bathroom.id]);
    else if (suggestion.address) {
      this.state.referenceLabel.set(suggestion.address.label);
      this.state.position.set(suggestion.address.position);
      this.state.query = '';
      await this.state.search();
      this.state.order();
    }
  }
  async submit(): Promise<void> {
    if (this.activeIndex >= 0) return this.choose(this.activeIndex);
    this.close();
    this.ui.sheet.set(1);
    await this.state.search();
  }
  close(): void {
    this.suggestions.cancel();
    this.ui.searchOpen.set(false);
    (document.activeElement as HTMLElement | null)?.blur();
  }
  clear(): void {
    this.state.query = '';
    this.edit();
    this.element.nativeElement.querySelector<HTMLInputElement>('input')?.focus();
  }
  key(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex = !this.suggestions.items().length ? -1 : this.activeIndex < 0 ? (event.key === 'ArrowDown' ? 0 : this.suggestions.items().length - 1) : (this.activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + this.suggestions.items().length) % this.suggestions.items().length;
    }
  }
  @HostListener('document:pointerdown', ['$event']) outside(event: PointerEvent): void {
    if (this.ui.searchOpen() && !this.element.nativeElement.contains(event.target as Node)) this.close();
  }
}
