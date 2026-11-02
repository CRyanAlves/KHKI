import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { NavigationService } from '../core/navigation.service';
import type { TravelRoute } from '../core/maps.service';
import { IconComponent } from './icon.component';
import { DirectionPreview, formatRouteDuration, upcomingDirections } from '../core/route-guidance';
import { ManeuverIconComponent } from './maneuver-icon.component';

@Component({ selector: 'app-navigation-tools', imports: [IconComponent, ManeuverIconComponent, DecimalPipe], templateUrl: './navigation-tools.component.html' })
export class NavigationToolsComponent implements AfterViewInit, OnDestroy {
  readonly navigation = inject(NavigationService);
  @Input() route: TravelRoute | null = null;
  @Output() occlusionChanged = new EventEmitter<number>();
  @ViewChild('stack') stack!: ElementRef<HTMLElement>;
  private observer?: ResizeObserver;
  private readonly now = signal(Date.now());
  private clock?: ReturnType<typeof setInterval>;
  get remainingDistance(): string {
    const distance = this.navigation.remainingMeters();
    return distance >= 1000 ? (distance / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' km' : Math.round(distance).toLocaleString('pt-BR') + ' m';
  }
  get remainingDuration(): string {
    const duration = this.navigation.remainingDurationMillis();
    return duration === 0 ? '0 min' : formatRouteDuration(duration);
  }
  get arrivalTime(): string {
    const duration = this.navigation.remainingDurationMillis();
    return duration === undefined ? 'Indisponível' : new Date(this.now() + duration).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  ngAfterViewInit(): void {
    this.clock = setInterval(() => {
      if (this.navigation.active()) this.now.set(Date.now());
    }, 1000);
    this.observer = new ResizeObserver(() => this.occlusionChanged.emit(this.stack.nativeElement.getBoundingClientRect().height));
    this.observer.observe(this.stack.nativeElement);
  }
  ngOnDestroy(): void {
    clearInterval(this.clock);
    this.observer?.disconnect();
  }
  get positioned(): boolean {
    return !!this.route?.maneuvers?.length && this.route.maneuvers.every((maneuver) => maneuver.fromMeters !== null);
  }
  get directions(): DirectionPreview[] {
    if (!this.route) return [];
    const maneuvers = this.route.maneuvers || this.route.instructions.map((text) => ({ text, type: 'None', icon: 'Navigation', fromMeters: null }));
    return upcomingDirections(maneuvers, this.navigation.active() ? this.navigation.traveled() : 0, this.navigation.arrived());
  }
  distanceLabel(direction: DirectionPreview): string {
    const distance = direction.distanceMeters;
    if (distance === null) return '';
    if (!this.navigation.active() && direction.index === 0 && distance === 0) return 'Início da rota';
    if (distance < 1) return 'Agora';
    return 'Em ' + (distance >= 1000 ? (distance / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' km' : Math.round(distance).toLocaleString('pt-BR') + ' m');
  }
  speed(event: Event): void {
    this.navigation.setSimulationSpeed(Number((event.target as HTMLSelectElement).value));
  }
}
