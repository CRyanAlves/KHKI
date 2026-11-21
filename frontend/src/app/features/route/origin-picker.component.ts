import { ChangeDetectorRef, Component, ElementRef, EventEmitter, HostListener, Input, OnDestroy, Output, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AddressSuggestion, MapsService } from '../../core/maps.service';
import { Location } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';

export interface OriginChoice {
  label: string;
  position: Location;
}
const SEARCH_DELAY_MILLIS = 350;

@Component({ selector: 'app-origin-picker', imports: [FormsModule, IconComponent], templateUrl: './origin-picker.component.html', styleUrl: './origin-picker.component.scss' })
export class OriginPickerComponent implements OnDestroy {
  @Input() value = '';
  @Input() selected = false;
  @Input() bias: Location | null = null;
  @Output() edited = new EventEmitter<string>();
  @Output() chosen = new EventEmitter<OriginChoice>();
  @Output() mapRequested = new EventEmitter<void>();
  @ViewChild('input') input?: ElementRef<HTMLInputElement>;
  private readonly maps = inject(MapsService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly element = inject(ElementRef<HTMLElement>);
  private timer?: ReturnType<typeof setTimeout>;
  private controller?: AbortController;
  private sequence = 0;
  private readonly cache = new Map<string, AddressSuggestion[]>();
  open = false;
  activeIndex = -1;
  suggestions: AddressSuggestion[] = [];
  busy = false;
  status = '';
  error = '';
  @HostListener('document:pointerdown', ['$event']) outside(event: PointerEvent): void {
    if (!this.element.nativeElement.contains(event.target as Node)) this.close();
  }
  show(): void {
    this.open = true;
    this.activeIndex = -1;
    if (!this.selected && this.value.trim().length >= 3) this.schedule();
  }
  close(): void {
    this.open = false;
    this.activeIndex = -1;
  }
  edit(value: string): void {
    this.cancel();
    this.value = value;
    this.suggestions = [];
    this.error = '';
    this.status = '';
    this.activeIndex = -1;
    this.open = true;
    this.edited.emit(value);
    if (value.trim().length >= 3) this.schedule();
  }
  clear(): void {
    this.edit('');
    this.input?.nativeElement.focus();
  }
  private cancel(): void {
    clearTimeout(this.timer);
    this.controller?.abort();
    this.controller = undefined;
    this.sequence++;
    this.busy = false;
  }
  private schedule(): void {
    this.cancel();
    const query = this.value.trim();
    const sequence = this.sequence;
    this.timer = setTimeout(() => {
      void this.search(query, sequence);
    }, SEARCH_DELAY_MILLIS);
  }
  private async search(query: string, sequence: number): Promise<void> {
    if (sequence !== this.sequence || !this.open) return;
    const key = JSON.stringify([query, this.bias]);
    const cached = this.cache.get(key);
    if (cached) {
      this.suggestions = cached;
      this.status = cached.length ? '' : 'Nenhum endereço encontrado. Tente completar o endereço.';
      this.changeDetector.markForCheck();
      return;
    }
    const controller = new AbortController();
    this.controller = controller;
    this.busy = true;
    this.status = 'Buscando endereços…';
    this.error = '';
    this.changeDetector.markForCheck();
    try {
      const suggestions = await this.maps.autocomplete(query, controller.signal, this.bias);
      if (sequence !== this.sequence) return;
      if (this.cache.size >= 20) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, suggestions);
      this.suggestions = suggestions;
      this.status = suggestions.length ? '' : 'Nenhum endereço encontrado. Tente completar o endereço.';
    } catch (error) {
      if (sequence === this.sequence && !controller.signal.aborted) {
        this.error = error instanceof Error ? error.message : 'Não foi possível buscar endereços.';
        this.status = '';
      }
    } finally {
      if (sequence === this.sequence) {
        this.busy = false;
        this.changeDetector.markForCheck();
      }
    }
  }
  async choose(index: number): Promise<void> {
    if (index === 1) {
      this.cancel();
      if (!this.maps.configured) {
        this.error = 'O mapa não está configurado. Escolha outra opção de origem.';
        return;
      }
      this.close();
      this.suggestions = [];
      this.status = '';
      this.error = '';
      this.mapRequested.emit();
      return;
    }
    if (index >= 2) {
      const result = this.suggestions[index - 2];
      if (result) this.accept({ label: result.label, position: result.position });
      return;
    }
    this.cancel();
    this.close();
    this.suggestions = [];
    this.busy = true;
    this.status = 'Obtendo sua localização…';
    this.error = '';
    const sequence = this.sequence;
    try {
      const position = await this.maps.location();
      if (sequence === this.sequence) this.accept({ label: 'Minha localização', position });
    } catch {
      if (sequence === this.sequence) {
        this.error = 'Não foi possível acessar sua localização. Autorize o acesso ou escolha um endereço ou ponto no mapa.';
        this.status = '';
        this.open = true;
      }
    } finally {
      if (sequence === this.sequence) {
        this.busy = false;
        this.changeDetector.markForCheck();
      }
    }
  }
  private accept(choice: OriginChoice): void {
    this.cancel();
    this.value = choice.label;
    this.suggestions = [];
    this.status = '';
    this.error = '';
    this.close();
    this.chosen.emit(choice);
    this.changeDetector.markForCheck();
  }
  async resolve(): Promise<void> {
    if (this.selected) {
      this.close();
      return;
    }
    const text = this.value.trim();
    if (text.length < 3) {
      this.status = 'Digite pelo menos 3 caracteres ou escolha uma opção.';
      return;
    }
    this.cancel();
    const controller = new AbortController();
    this.controller = controller;
    const sequence = this.sequence;
    this.busy = true;
    this.status = 'Resolvendo endereço…';
    this.error = '';
    try {
      const position = await this.maps.geocode(text, controller.signal);
      if (sequence === this.sequence) this.accept({ label: text, position });
    } catch (error) {
      if (sequence === this.sequence && !controller.signal.aborted) {
        this.error = error instanceof Error ? error.message : 'Não foi possível localizar o endereço.';
        this.status = '';
      }
    } finally {
      if (sequence === this.sequence) {
        this.busy = false;
        this.changeDetector.markForCheck();
      }
    }
  }
  keydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' || event.key === 'Tab') {
      this.close();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!this.open) this.show();
      const count = 2 + this.suggestions.length;
      this.activeIndex = this.activeIndex < 0 ? (event.key === 'ArrowDown' ? 0 : count - 1) : (this.activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + count) % count;
      this.element.nativeElement.querySelector('#route-origin-option-' + this.activeIndex)?.scrollIntoView({ block: 'nearest' });
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.open && this.activeIndex >= 0) void this.choose(this.activeIndex);
      else if (this.open && this.suggestions.length) void this.choose(2);
      else void this.resolve();
    }
  }
  ngOnDestroy(): void {
    this.cancel();
  }
}
