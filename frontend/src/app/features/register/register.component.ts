import { ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { MapsService } from '../../core/maps.service';
import { Bathroom, BathroomInput, ITEM_LABELS, Location, NearbyResult, ACCESS_LABELS } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';
import { MapComponent } from '../../shared/map.component';
import { validatePhoto } from '../../shared/photo-validation';
import { RegistrationHours } from './registration-hours';
import { PhotoDraft, RegistrationSubmissionService } from './registration-submission.service';

import { SkeletonComponent } from '../../shared/skeleton.component';

@Component({ selector: 'app-register', imports: [SkeletonComponent, FormsModule, RouterLink, DecimalPipe, IconComponent, MapComponent], providers: [RegistrationSubmissionService], templateUrl: './register.component.html' })
export class RegisterComponent implements OnInit, OnDestroy {
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly maps = inject(MapsService);
  readonly submission = inject(RegistrationSubmissionService);
  readonly hours = new RegistrationHours();
  readonly accessLabels = ACCESS_LABELS;
  @ViewChild('existingDialog') existingDialog!: ElementRef<HTMLDialogElement>;
  @ViewChild('photoDialog') photoDialog!: ElementRef<HTMLDialogElement>;
  photoPreview = '';
  form: BathroomInput = { name: '', address: '', complement: '', category: 'Estabelecimento', latitude: null, longitude: null, access: 'FREE', accessDetails: '', hours: '', accessible: null, items: [] };
  readonly itemEntries = Object.entries(ITEM_LABELS);
  step = 0;
  busy = false;
  error = '';
  success = false;
  locating = false;
  loadingEdit = false;
  editId = '';
  changed = false;
  errors: Record<string, string> = {};
  photos: PhotoDraft[] = [];
  point: Location | null = null;
  bathrooms: Bathroom[] = [];
  preview: Bathroom | null = null;
  nearby: NearbyResult | null = null;
  nearbyLoading = false;
  initialMapLoading = true;
  nearbyError = '';
  radius: number | null = null;
  positionAddress = '';
  positionHint = '';
  uploadWarning = '';
  private nearbySequence = 0;
  private locationSequence = 0;
  private nearbyTimer?: ReturnType<typeof setTimeout>;
  private destroyed = false;
  get locked(): boolean {
    return this.busy || !!this.submission.createdId || this.submission.uncertain || this.loadingEdit;
  }
  get addressChanged(): boolean {
    return !!this.point && this.positionAddress !== this.form.address.trim();
  }
  get dirty(): boolean {
    return !this.success && (this.changed || this.photos.some((photo) => !photo.uploaded));
  }
  ngOnInit(): void {
    this.editId = this.route.snapshot.queryParamMap.get('edit') || '';
    if (this.editId) void this.loadEdit();
    else void this.loadInitialMap();
  }
  async loadInitialMap(): Promise<void> {
    this.initialMapLoading = true;
    try {
      const bathrooms = await this.api.get<Bathroom[]>('/bathrooms');
      if (!this.destroyed && !this.point) this.bathrooms = bathrooms;
    } catch {
      this.nearbyError = 'Não foi possível carregar os banheiros existentes. Você pode posicionar o novo cadastro e tentar a consulta novamente.';
    } finally {
      this.initialMapLoading = false;
      this.changeDetector.markForCheck();
    }
  }
  async loadEdit(): Promise<void> {
    this.loadingEdit = true;
    this.initialMapLoading = false;
    try {
      const bathroom = await this.api.get<Bathroom>('/me/contributions/BATHROOM/' + this.editId);
      this.form = { name: bathroom.name, address: bathroom.address, complement: bathroom.complement || '', category: bathroom.category, latitude: bathroom.latitude, longitude: bathroom.longitude, access: bathroom.access, accessDetails: bathroom.accessDetails || '', hours: bathroom.hours || '', accessible: bathroom.accessible, items: [...bathroom.items] };
      this.hours.load(this.form.hours);
      this.point = { lat: bathroom.latitude, lng: bathroom.longitude };
      this.positionAddress = bathroom.address.trim();
      void this.checkNearby();
    } catch (error) {
      this.error = this.api.error(error);
    } finally {
      this.loadingEdit = false;
      this.changeDetector.markForCheck();
    }
  }
  placeChanged(): void {
    this.changed = true;
    if (this.form.name.trim()) delete this.errors['name'];
    if (this.form.address.trim()) delete this.errors['address'];
    this.nearby = null;
    this.nearbyLoading = false;
    this.nearbyError = '';
    ++this.nearbySequence;
    clearTimeout(this.nearbyTimer);
    if (this.point) this.nearbyTimer = setTimeout(() => void this.checkNearby(), 350);
  }
  moved(point: Location): void {
    if (this.locked || !Number.isFinite(point.lat) || Math.abs(point.lat) > 90 || !Number.isFinite(point.lng) || Math.abs(point.lng) > 180) return;
    ++this.locationSequence;
    this.point = { lat: Number(point.lat.toFixed(6)), lng: Number(point.lng.toFixed(6)) };
    this.form.latitude = this.point.lat;
    this.form.longitude = this.point.lng;
    this.positionAddress = this.form.address.trim();
    this.positionHint = 'Ponto ajustado. Confira se o endereço digitado corresponde à posição; ele não foi alterado automaticamente.';
    delete this.errors['location'];
    this.placeChanged();
  }
  manualCoordinates(): void {
    if (this.form.latitude !== null && this.form.longitude !== null) this.moved({ lat: this.form.latitude, lng: this.form.longitude });
    else {
      this.point = null;
      this.placeChanged();
    }
  }
  confirmPosition(): void {
    this.positionAddress = this.form.address.trim();
    this.changed = true;
    delete this.errors['location'];
    void this.checkNearby();
  }
  async geocode(): Promise<void> {
    if (this.locked || this.locating) return;
    if (!this.form.address.trim()) {
      this.errors['address'] = 'Informe o endereço ou estabelecimento que deseja buscar.';
      return;
    }
    const address = this.form.address.trim();
    const sequence = ++this.locationSequence;
    this.locating = true;
    this.error = '';
    delete this.errors['address'];
    try {
      const point = await this.maps.geocode(address);
      if (sequence === this.locationSequence && address === this.form.address.trim()) {
        this.moved(point);
        this.positionHint = 'Endereço localizado. Arraste o pin ou clique no mapa para ajustar o ponto exato.';
      }
    } catch (error) {
      if (sequence === this.locationSequence) this.errors['location'] = this.api.error(error);
    } finally {
      this.locating = false;
      this.changeDetector.markForCheck();
    }
  }
  async locate(): Promise<void> {
    if (this.locked || this.locating) return;
    const sequence = ++this.locationSequence;
    this.locating = true;
    this.error = '';
    try {
      const point = await this.maps.location();
      if (sequence === this.locationSequence) {
        this.moved(point);
        this.positionHint = 'Localização obtida. Informe ou confira o endereço; o GPS não confirma o endereço do banheiro.';
      }
    } catch {
      if (sequence === this.locationSequence) this.errors['location'] = 'Não foi possível acessar sua localização. Busque um endereço ou escolha o ponto no mapa.';
    } finally {
      this.locating = false;
      this.changeDetector.markForCheck();
    }
  }
  async checkNearby(): Promise<void> {
    if (!this.point) return;
    clearTimeout(this.nearbyTimer);
    const sequence = ++this.nearbySequence;
    this.nearbyLoading = true;
    this.nearbyError = '';
    this.nearby = null;
    const params: Record<string, string> = { name: this.form.name, address: this.form.address, complement: this.form.complement || '', latitude: String(this.point.lat), longitude: String(this.point.lng) };
    if (this.radius !== null) params['radiusMeters'] = String(this.radius);
    try {
      const result = await this.api.get<NearbyResult>('/bathrooms/nearby', params);
      if (sequence !== this.nearbySequence || this.destroyed) return;
      result.candidates = result.candidates.filter((candidate) => candidate.bathroom.id !== this.editId);
      this.nearby = result;
      this.bathrooms = result.candidates.map((candidate) => candidate.bathroom);
    } catch (error) {
      if (sequence === this.nearbySequence) this.nearbyError = this.api.error(error);
    } finally {
      if (sequence === this.nearbySequence) {
        this.nearbyLoading = false;
        this.changeDetector.markForCheck();
      }
    }
  }
  inspect(bathroom: Bathroom): void {
    this.preview = bathroom;
    this.existingDialog.nativeElement.showModal();
  }
  inspectPhoto(photo: PhotoDraft): void {
    this.photoPreview = photo.preview;
    this.photoDialog.nativeElement.showModal();
  }
  selectExisting(id: string): void {
    const bathroom = this.bathrooms.find((value) => value.id === id);
    if (bathroom) this.inspect(bathroom);
  }
  toggle(item: string): void {
    if (this.locked) return;
    this.form.items = this.form.items.includes(item) ? this.form.items.filter((value) => value !== item) : [...this.form.items, item];
    this.changed = true;
  }
  choose(event: Event): void {
    const input = event.target as HTMLInputElement;
    const incoming = Array.from(input.files || []);
    input.value = '';
    if (this.busy || this.loadingEdit || this.submission.uncertain) return;
    if (incoming.length + this.photos.length > 5 || incoming.some((file) => validatePhoto(file))) {
      this.errors['photos'] = 'Escolha até 5 fotos JPG ou PNG, com no máximo 5 MB cada.';
      return;
    }
    delete this.errors['photos'];
    this.photos.push(...incoming.map((file) => ({ file, preview: URL.createObjectURL(file), key: crypto.randomUUID(), uploaded: false, error: '' })));
    this.changed = true;
  }
  removePhoto(photo: PhotoDraft): void {
    if (this.busy || photo.uploaded || photo.uncertain) return;
    URL.revokeObjectURL(photo.preview);
    this.photos = this.photos.filter((value) => value !== photo);
    this.changed = true;
  }
  validateLocation(): boolean {
    this.errors = {};
    if (!this.form.name.trim()) this.errors['name'] = 'Informe o nome do local.';
    if (!this.form.address.trim()) this.errors['address'] = 'Informe o endereço do banheiro.';
    if (!this.point || !Number.isFinite(this.form.latitude) || !Number.isFinite(this.form.longitude) || Math.abs(this.form.latitude!) > 90 || Math.abs(this.form.longitude!) > 180) this.errors['location'] = 'Busque um endereço, escolha um ponto no mapa ou informe coordenadas válidas.';
    else if (this.addressChanged) this.errors['location'] = 'O endereço mudou. Busque novamente ou confirme que este ponto corresponde ao endereço informado.';
    return !Object.keys(this.errors).length;
  }
  next(): void {
    if (this.busy || this.loadingEdit) return;
    if (!this.submission.createdId && !this.validateLocation()) return;
    this.error = '';
    this.step = 1;
  }
  async submit(): Promise<void> {
    if (this.busy) return;
    if (!this.submission.createdId) {
      if (!this.validateLocation()) {
        this.step = 0;
        return;
      }
      if (!this.form.category.trim()) {
        this.errors['category'] = 'Informe o tipo de estabelecimento.';
        return;
      }
      try {
        this.form.hours = this.hours.value();
      } catch (error) {
        this.errors['hours'] = this.api.error(error);
        return;
      }
    }
    this.busy = true;
    this.error = '';
    this.uploadWarning = '';
    try {
      this.success = await this.submission.send(this.form, this.editId, this.photos);
      if (!this.success) this.uploadWarning = 'O cadastro já foi salvo em análise. Algumas fotos falharam; tente enviar somente as restantes. As fotos já recebidas não serão duplicadas.';
    } catch (error) {
      this.error = this.api.error(error);
    } finally {
      this.busy = false;
      this.changeDetector.markForCheck();
    }
  }
  canLeave(): boolean {
    return !this.busy && (!this.dirty || window.confirm('Há alterações ou fotos não enviadas. Deseja sair do cadastro e descartar o rascunho?'));
  }
  cancel(): void {
    if (!this.busy) void this.router.navigateByUrl('/');
  }
  @HostListener('window:beforeunload', ['$event']) warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
  ngOnDestroy(): void {
    this.destroyed = true;
    ++this.nearbySequence;
    ++this.locationSequence;
    clearTimeout(this.nearbyTimer);
    this.photos.forEach((photo) => URL.revokeObjectURL(photo.preview));
  }
}
