import { OriginPickerComponent, OriginChoice } from '../route/origin-picker.component';
import { ExplorationState } from '../workspace/exploration-state.service';
import { ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { MapsService } from '../../core/maps.service';
import { Bathroom, BathroomDetails, BathroomInput, ITEM_LABELS, Location, NearbyResult, ACCESS_LABELS } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';
import { validatePhoto } from '../../shared/photo-validation';
import { emptyBathroomDetails, legacyAccess, bathroomDetailRows, OBSERVED_ACCESSIBILITY, BATHROOM_TYPE_LABELS, triStateLabel } from '../../core/bathroom-details';
import { RegistrationHours } from './registration-hours';
import { PhotoDraft, RegistrationSubmissionService } from './registration-submission.service';

import { SkeletonComponent } from '../../shared/skeleton.component';

@Component({ selector: 'app-register', imports: [OriginPickerComponent, SkeletonComponent, FormsModule, RouterLink, IconComponent], providers: [RegistrationSubmissionService], templateUrl: './register.component.html' })
export class RegisterComponent implements OnInit, OnDestroy {
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly maps = inject(MapsService);
  private readonly workspace = inject(ExplorationState);
  resolvingAddress = false;
  private addressController?: AbortController;
  private addressSequence = 0;
  pickingAddress = false;
  addressEdited(value: string): void {
    if (this.locked) return;
    this.cancelAddressLookup();
    if (this.point) this.positionHint = 'Endereço editado. Confira se o ponto corresponde ao endereço informado.';
    this.form.address = value;
    this.placeChanged();
  }
  addressChosen(choice: OriginChoice): void {
    if (this.locked) return;
    this.form.address = choice.label;
    this.moved(choice.position, !!choice.coordinateOnly);
  }
  selectAddressOnMap(): void {
    if (this.locked) return;
    this.pickingAddress = true;
    if (window.matchMedia('(max-width: ' + getComputedStyle(document.documentElement).getPropertyValue('--breakpoint-mobile').trim() + ')').matches) this.workspace.collapsed.set(true);
  }
  cancelAddressSelection(): void {
    this.pickingAddress = false;
    this.workspace.collapsed.set(false);
  }
  readonly submission = inject(RegistrationSubmissionService);
  readonly hours = new RegistrationHours();
  readonly accessLabels = ACCESS_LABELS;
  @ViewChild('existingDialog') existingDialog!: ElementRef<HTMLDialogElement>;
  @ViewChild('photoDialog') photoDialog!: ElementRef<HTMLDialogElement>;
  photoPreview = '';
  form: BathroomInput = { name: '', address: '', complement: '', category: '', latitude: null, longitude: null, access: 'OTHER', accessDetails: '', hours: '', accessible: null, items: [], details: emptyBathroomDetails() };
  readonly categories = ['Biblioteca', 'Shopping', 'Posto', 'Restaurante', 'Cafeteria', 'Parque', 'Terminal', 'Espaço público', 'Estabelecimento', 'Outro'];
  readonly accessibilityFields = OBSERVED_ACCESSIBILITY;
  readonly typeEntries = Object.entries(BATHROOM_TYPE_LABELS);
  readonly today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  get details(): BathroomDetails {
    return this.form.details!;
  }
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
      this.form = {
        name: bathroom.name,
        address: bathroom.address,
        complement: bathroom.complement || '',
        category: bathroom.category,
        latitude: bathroom.latitude,
        longitude: bathroom.longitude,
        access: bathroom.access,
        accessDetails: bathroom.accessDetails || '',
        hours: bathroom.hours || '',
        accessible: bathroom.accessible,
        items: [...bathroom.items],
        details: { ...emptyBathroomDetails(bathroom.access), ...bathroom.details, bathroomTypes: [...(bathroom.details?.bathroomTypes || [])] }
      };
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
  moved(point: Location, resolveAddress = true): void {
    if (this.locked || !Number.isFinite(point.lat) || Math.abs(point.lat) > 90 || !Number.isFinite(point.lng) || Math.abs(point.lng) > 180) return;
    this.cancelAddressLookup();
    if (this.pickingAddress) this.cancelAddressSelection();
    ++this.locationSequence;
    this.point = { lat: Number(point.lat.toFixed(6)), lng: Number(point.lng.toFixed(6)) };
    this.form.latitude = this.point.lat;
    this.form.longitude = this.point.lng;
    this.positionAddress = this.form.address.trim();
    this.positionHint = 'Ponto ajustado. Confira o endereço e a posição da entrada.';
    delete this.errors['location'];
    this.placeChanged();
    if (resolveAddress) void this.resolvePointAddress(this.point);
  }
  private cancelAddressLookup(): void {
    this.addressController?.abort();
    this.addressController = undefined;
    this.addressSequence++;
    this.resolvingAddress = false;
    delete this.errors['reverseAddress'];
  }
  private async resolvePointAddress(point: Location): Promise<void> {
    const sequence = this.addressSequence;
    const previousAddress = this.form.address;
    const controller = new AbortController();
    this.addressController = controller;
    this.resolvingAddress = true;
    this.positionHint = 'Buscando o endereço deste ponto…';
    try {
      const address = await this.maps.reverseGeocode(point, controller.signal);
      if (sequence !== this.addressSequence || this.destroyed || this.form.address !== previousAddress) return;
      this.form.address = address;
      this.positionAddress = address;
      this.placeChanged();
      this.positionHint = 'Endereço preenchido pela posição. Confira o número e a entrada do local.';
    } catch (error) {
      if (sequence === this.addressSequence && !controller.signal.aborted && !this.destroyed) {
        this.errors['reverseAddress'] = this.api.error(error);
        this.positionHint = 'O ponto foi mantido. Você pode preencher ou corrigir o endereço manualmente.';
      }
    } finally {
      if (sequence === this.addressSequence && !this.destroyed) {
        this.resolvingAddress = false;
        this.addressController = undefined;
        this.changeDetector.markForCheck();
      }
    }
  }
  confirmPosition(): void {
    this.positionAddress = this.form.address.trim();
    this.changed = true;
    delete this.errors['location'];
    void this.checkNearby();
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
    if (!this.form.category.trim()) this.errors['category'] = 'Selecione a categoria do local.';
    if (!this.form.address.trim()) this.errors['address'] = 'Informe o endereço do banheiro.';
    if (!this.point || !Number.isFinite(this.form.latitude) || !Number.isFinite(this.form.longitude) || Math.abs(this.form.latitude!) > 90 || Math.abs(this.form.longitude!) > 180) this.errors['location'] = 'Busque um endereço ou escolha um ponto válido no mapa.';
    else if (this.addressChanged) this.errors['location'] = 'O endereço mudou. Busque novamente ou confirme que este ponto corresponde ao endereço informado.';
    return !Object.keys(this.errors).length;
  }
  validateAccess(): boolean {
    delete this.errors['hours'];
    delete this.errors['fee'];
    try {
      this.form.hours = this.hours.value();
    } catch (error) {
      this.errors['hours'] = this.api.error(error);
    }
    const amount = this.details.feeAmount;
    if (amount !== null && (!Number.isFinite(amount) || amount <= 0 || amount > 999999.99 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001)) this.errors['fee'] = 'Informe um valor positivo com até duas casas decimais, ou deixe em branco.';
    return !this.errors['hours'] && !this.errors['fee'];
  }
  goTo(step: number): void {
    if (this.busy || this.loadingEdit || ![0, 1, 2].includes(step)) return;
    this.step = step;
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('.registration-fields')?.scrollTo({ top: 0 });
      document.querySelector<HTMLElement>('.registration-progress [aria-current="step"]')?.focus({ preventScroll: true });
    });
  }
  chargeChanged(): void {
    this.changed = true;
    if (this.details.charge !== 'YES') this.details.feeAmount = null;
    delete this.errors['fee'];
  }
  toggleType(type: string): void {
    if (this.locked || !this.typeEntries.some((entry) => entry[0] === type)) return;
    this.details.bathroomTypes = this.details.bathroomTypes.includes(type) ? this.details.bathroomTypes.filter((value) => value !== type) : [...this.details.bathroomTypes, type];
    this.changed = true;
  }
  get reviewRows(): { label: string; value: string; step: number }[] {
    return [
      { label: 'Estabelecimento', value: this.form.name, step: 0 },
      { label: 'Categoria', value: this.form.category, step: 0 },
      { label: 'Endereço', value: this.form.address, step: 0 },
      { label: 'Como encontrar', value: this.form.complement || 'Não informado', step: 0 },
      { label: 'Entrada no mapa', value: this.point ? this.point.lat + ', ' + this.point.lng : 'Não informada', step: 0 },
      ...bathroomDetailRows(this.details).map((row) => ({ ...row, step: row.label === 'Última visita' ? 2 : 1 })),
      { label: 'Detalhes do acesso', value: this.form.accessDetails || 'Não informado', step: 1 },
      { label: 'Horário', value: this.form.hours || 'Não informado', step: 1 },
      { label: 'Estrutura', value: this.form.items.map((item) => ITEM_LABELS[item]).join(', ') || 'Não informada', step: 1 },
      { label: 'Acessibilidade geral informada', value: triStateLabel(this.form.accessible), step: 1 },
      { label: 'Fotos', value: this.photos.length ? this.photos.map((photo) => photo.file.name).join(', ') : 'Não informadas', step: 2 }
    ];
  }
  next(): void {
    if (this.busy || this.loadingEdit || this.resolvingAddress) return;
    if (!this.submission.createdId && (this.step === 0 ? !this.validateLocation() : !this.validateAccess())) return;
    this.error = '';
    this.goTo(Math.min(2, this.step + 1));
  }
  async submit(): Promise<void> {
    if (this.busy || this.resolvingAddress) return;
    if (!this.submission.createdId) {
      if (!this.validateLocation()) {
        this.goTo(0);
        return;
      }
      if (!this.validateAccess()) {
        this.goTo(1);
        return;
      }
      delete this.errors['lastVisited'];
      if (this.details.lastVisited && (!/^\d{4}-\d{2}-\d{2}$/.test(this.details.lastVisited) || this.details.lastVisited > this.today)) {
        this.errors['lastVisited'] = 'Informe uma data válida que não esteja no futuro.';
        return;
      }
      this.form.access = legacyAccess(this.details);
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
    this.cancelAddressLookup();
    this.destroyed = true;
    ++this.nearbySequence;
    ++this.locationSequence;
    clearTimeout(this.nearbyTimer);
    this.photos.forEach((photo) => URL.revokeObjectURL(photo.preview));
  }
}
