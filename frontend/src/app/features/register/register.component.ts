import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { MapsService } from '../../core/maps.service';
import { Bathroom, BathroomInput, Contribution, ITEM_LABELS, Location } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';
import { MapComponent } from '../../shared/map.component';
import { validatePhoto } from '../../shared/photo-validation';

@Component({ selector: 'app-register', imports: [FormsModule, RouterLink, IconComponent, MapComponent], templateUrl: './register.component.html' })
export class RegisterComponent implements OnInit, OnDestroy {
  private readonly changeDetector = inject(ChangeDetectorRef);
  readonly auth = inject(AuthService); readonly maps = inject(MapsService);
  private readonly api = inject(ApiService); private readonly route = inject(ActivatedRoute);
  form: BathroomInput = { name: '', address: '', category: 'Estabelecimento', latitude: null, longitude: null, access: 'FREE', accessDetails: '', hours: '', accessible: null, items: [] };
  readonly itemEntries = Object.entries(ITEM_LABELS);
  step = 0; busy = false; error = ''; success = false; locating = false; duplicates: Bathroom[] = []; duplicateChecked = false; files: File[] = []; previews: string[] = []; uploadWarning = ''; createdId = ''; editId = '';
  get point(): Location | null { return this.form.latitude === null || this.form.longitude === null ? null : { lat: this.form.latitude, lng: this.form.longitude }; }
  ngOnInit(): void { this.editId = this.route.snapshot.queryParamMap.get('edit') || ''; if (this.editId) void this.loadEdit(); }
  async loadEdit(): Promise<void> { try { const bathroom = await this.api.get<Bathroom>('/me/contributions/BATHROOM/' + this.editId); this.form = { ...bathroom, accessDetails: bathroom.accessDetails || '', hours: bathroom.hours || '' }; } catch (error) { this.error = this.api.error(error); } finally { this.changeDetector.markForCheck(); } }
  toggle(item: string): void { this.form.items = this.form.items.includes(item) ? this.form.items.filter(value => value !== item) : [...this.form.items, item]; }
  moved(point: Location): void { this.form.latitude = Number(point.lat.toFixed(6)); this.form.longitude = Number(point.lng.toFixed(6)); this.duplicateChecked = false; }
  async geocode(): Promise<void> { this.locating = true; this.error = ''; try { this.moved(await this.maps.geocode(this.form.address)); } catch (error) { this.error = this.api.error(error); } finally { this.changeDetector.markForCheck(); this.locating = false; } }
  choose(event: Event): void {
    const input = event.target as HTMLInputElement; const incoming = Array.from(input.files || []);
    if (incoming.some(file => validatePhoto(file)) || incoming.length + this.files.length > 5) { this.error = 'Escolha até 5 fotos JPG ou PNG, com no máximo 5 MB cada.'; input.value = ''; return; }
    this.files.push(...incoming); this.previews.push(...incoming.map(file => URL.createObjectURL(file))); input.value = '';
  }
  removePhoto(index: number): void { URL.revokeObjectURL(this.previews[index]); this.files.splice(index, 1); this.previews.splice(index, 1); }
  ngOnDestroy(): void { this.previews.forEach(url => URL.revokeObjectURL(url)); }
  next(): void { if (this.step === 0 && (!this.form.name.trim() || !this.form.address.trim())) { this.error = 'Preencha o nome do local e o endereço.'; return; } if (this.step === 1 && !this.point) { this.error = 'Informe a latitude e a longitude ou localize o endereço no mapa.'; return; } this.error = ''; this.step = Math.min(4, this.step + 1); }
  async submit(): Promise<void> {
    this.busy = true; this.error = '';
    try {
      if (!this.point) throw new Error('Informe a localização do banheiro.');
      if (!this.duplicateChecked) { this.duplicates = await this.api.get<Bathroom[]>('/bathrooms/duplicates', { name: this.form.name, latitude: String(this.form.latitude), longitude: String(this.form.longitude) }); this.duplicateChecked = true; if (this.duplicates.some(value => value.id !== this.editId)) return; }
      const input: BathroomInput = { name: this.form.name, address: this.form.address, category: this.form.category, latitude: this.form.latitude, longitude: this.form.longitude, access: this.form.access, accessDetails: this.form.accessDetails, hours: this.form.hours, accessible: this.form.accessible, items: this.form.items };
      const contribution = this.editId ? await this.api.put<Contribution>('/bathrooms/' + this.editId, input) : await this.api.post<Contribution>('/bathrooms', input);
      this.createdId = contribution.id;
      for (const file of this.files) { const body = new FormData(); body.append('file', file); try { await this.api.post('/bathrooms/' + contribution.id + '/photos', body); } catch (error) { this.uploadWarning = 'O cadastro foi salvo, mas uma ou mais fotos não foram enviadas: ' + this.api.error(error); } }
      this.success = true; this.previews.forEach(url => URL.revokeObjectURL(url));
    } catch (error) { this.error = this.api.error(error); } finally { this.changeDetector.markForCheck(); this.busy = false; }
  }
}
