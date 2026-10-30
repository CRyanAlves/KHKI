import { Component, Input } from '@angular/core';
import {
  LucideDynamicIcon,
  LucideIcon,
  LucideNavigation as Navigation,
  LucideArrowUp as ArrowUp,
  LucideArrowUpLeft as ArrowUpLeft,
  LucideArrowUpRight as ArrowUpRight,
  LucideCornerUpLeft as CornerUpLeft,
  LucideCornerUpRight as CornerUpRight,
  LucideCornerDownLeft as CornerDownLeft,
  LucideCornerDownRight as CornerDownRight,
  LucideUndo2 as Undo2,
  LucideRedo2 as Redo2,
  LucideMerge as Merge,
  LucideRotateCw as RotateCw,
  LucideShip as Ship,
  LucideFlag as Flag
} from '@lucide/angular';

@Component({ selector: 'app-maneuver-icon', imports: [LucideDynamicIcon], template: '<svg [lucideIcon]="icon" [size]="size" [strokeWidth]="1.8" aria-hidden="true" />', styleUrl: './icon.component.scss' })
export class ManeuverIconComponent {
  @Input() name = 'Navigation';
  @Input() size = 24;
  private readonly icons: Record<string, LucideIcon> = { Navigation, ArrowUp, ArrowUpLeft, ArrowUpRight, CornerUpLeft, CornerUpRight, CornerDownLeft, CornerDownRight, Undo2, Redo2, Merge, RotateCw, Ship, Flag };
  get icon(): LucideIcon {
    return Object.hasOwn(this.icons, this.name) ? this.icons[this.name] : this.icons['Navigation'];
  }
}
