import { ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MobileUiService } from '../core/mobile-ui.service';
import { ExplorationState } from '../features/workspace/exploration-state.service';
import { ApiService } from '../core/api.service';
import { AddressSuggestion, MapsService } from '../core/maps.service';
import { Bathroom } from '../core/models';
import { AccountAvatarComponent } from './account-avatar.component';
import { ExploreFilterBarComponent } from '../features/explore/explore-filter-bar.component';
import { IconComponent } from './icon.component';

@Component({ selector: 'app-mobile-search', imports: [ExploreFilterBarComponent, FormsModule, IconComponent, AccountAvatarComponent], templateUrl: './mobile-search.component.html' })
export class MobileSearchComponent implements OnDestroy {
  readonly areaSearchAvailable = input(false);
  readonly areaSearchRequested = output<void>();
  readonly ui = inject(MobileUiService);
  readonly state = inject(ExplorationState);
  private readonly maps = inject(MapsService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly changeDetector = inject(ChangeDetectorRef);
  suggestions: { label: string; detail: string; bathroom?: Bathroom; address?: AddressSuggestion }[] = [];
  busy = false;
  error = '';
  activeIndex = -1;
  private timer?: ReturnType<typeof setTimeout>;
  private controller?: AbortController;
  private sequence = 0;
  focus(): void {
    this.ui.searchOpen.set(true);
    this.edit();
  }
  edit(): void {
    clearTimeout(this.timer);
    this.controller?.abort();
    const sequence = ++this.sequence;
    this.activeIndex = -1;
    this.suggestions = [];
    this.error = '';
    this.busy = false;
    if (this.state.query.trim().length < 3) return;
    this.busy = true;
    this.timer = setTimeout(() => void this.load(sequence), 350);
  }
  private async load(sequence: number): Promise<void> {
    const controller = new AbortController();
    this.controller = controller;
    const query = this.state.query.trim();
    const [bathrooms, addresses] = await Promise.allSettled([this.api.get<Bathroom[]>('/bathrooms', { q: query }), this.maps.configured ? this.maps.autocomplete(query, controller.signal, this.state.position()) : Promise.resolve([])]);
    if (sequence !== this.sequence || controller.signal.aborted) return;
    this.suggestions = [...(bathrooms.status === 'fulfilled' ? bathrooms.value.slice(0, 5).map((bathroom) => ({ label: bathroom.name, detail: bathroom.address, bathroom })) : []), ...(addresses.status === 'fulfilled' ? addresses.value.map((address) => ({ label: address.label, detail: address.detail, address })) : [])];
    if (bathrooms.status === 'rejected' || addresses.status === 'rejected') this.error = 'Parte das sugestões está indisponível. Você pode tentar novamente ou buscar os locais cadastrados.';
    this.busy = false;
    this.changeDetector.markForCheck();
  }
  async choose(index: number): Promise<void> {
    const suggestion = this.suggestions[index];
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
    clearTimeout(this.timer);
    this.controller?.abort();
    this.sequence++;
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
      this.activeIndex = !this.suggestions.length ? -1 : this.activeIndex < 0 ? (event.key === 'ArrowDown' ? 0 : this.suggestions.length - 1) : (this.activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + this.suggestions.length) % this.suggestions.length;
    }
  }
  @HostListener('document:pointerdown', ['$event']) outside(event: PointerEvent): void {
    if (this.ui.searchOpen() && !this.element.nativeElement.contains(event.target as Node)) this.close();
  }
  ngOnDestroy(): void {
    clearTimeout(this.timer);
    this.controller?.abort();
    this.sequence++;
  }
}
