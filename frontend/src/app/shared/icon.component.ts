import { Component, Input } from '@angular/core';
import { LucideCar as Car, LucideMotorbike as Motorbike, LucideBike as Bike } from '@lucide/angular';
import { LucideDynamicIcon, LucideIcon, LucideSun as Sun, LucideMoon as Moon, LucideSearch as Search, LucideSlidersHorizontal as SlidersHorizontal, LucideAccessibility as Accessibility, LucideBaby as Baby, LucideArrowRight as ArrowRight, LucideArrowLeft as ArrowLeft, LucideMapPin as MapPin, LucideNavigation as Navigation, LucideStar as Star, LucideClock as Clock, LucideX as X, LucidePlus as Plus, LucideMinus as Minus, LucideLocateFixed as LocateFixed, LucideChevronRight as ChevronRight, LucideCheck as Check, LucideToilet as Toilet, LucideEye as Eye, LucideFlag as Flag, LucideUpload as Upload, LucideCoffee as Coffee, LucideShieldCheck as ShieldCheck, LucideLogOut as LogOut, LucideMap as Map, LucideCamera as Camera, LucideUser as User, LucideMenu as Menu, LucideCircleCheck as CheckCircle, LucideHeart as Heart, LucideFootprints as Footprints, LucideBuilding2 as Building2, LucideDroplets as Droplets, LucideTrash2 as Trash2, LucideChevronDown as ChevronDown, LucideInfo as Info, LucideMonitor as Monitor, LucideLockKeyhole as LockKeyhole } from '@lucide/angular';

@Component({ selector: 'app-icon', imports: [LucideDynamicIcon], template: '<svg [lucideIcon]="icons[name] || icons[\'MapPin\']" [size]="size" [strokeWidth]="1.8" aria-hidden="true" />', styleUrl: './icon.component.scss' })
export class IconComponent {
  @Input() name = 'MapPin';
  @Input() size = 20;
  readonly icons: Record<string, LucideIcon> = {
    Car,
    Motorbike,
    Bike,
    Sun,
    Moon,
    Search,
    SlidersHorizontal,
    Accessibility,
    Baby,
    ArrowRight,
    ArrowLeft,
    MapPin,
    Navigation,
    Star,
    Clock,
    X,
    Plus,
    Minus,
    LocateFixed,
    ChevronRight,
    Check,
    Toilet,
    Eye,
    Flag,
    Upload,
    Coffee,
    ShieldCheck,
    LogOut,
    Map,
    Camera,
    User,
    Menu,
    CheckCircle,
    Heart,
    Footprints,
    Building2,
    Droplets,
    Trash2,
    ChevronDown,
    Info,
    Monitor,
    LockKeyhole
  };
}
