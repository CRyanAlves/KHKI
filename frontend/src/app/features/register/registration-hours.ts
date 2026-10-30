export class RegistrationHours {
  mode: 'unknown' | 'daily' | 'always' | 'custom' = 'unknown';
  opening = '';
  closing = '';
  custom = '';
  load(value: string): void {
    this.custom = value;
    this.mode = value.trim() ? 'custom' : 'unknown';
  }
  value(): string {
    if (this.mode === 'unknown') return '';
    if (this.mode === 'always') return 'Todos os dias, 24 horas';
    if (this.mode === 'custom') {
      if (!this.custom.trim()) throw new Error('Informe os dias, horários e dias fechados, ou selecione “Não sei informar”.');
      return this.custom.trim();
    }
    const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    if (!time.test(this.opening) || !time.test(this.closing)) throw new Error('Informe a abertura e o fechamento.');
    if (this.opening === this.closing) throw new Error('Para funcionamento contínuo, selecione “24 horas”.');
    return 'Todos os dias, das ' + this.opening + ' às ' + this.closing + (this.closing < this.opening ? ' (até o dia seguinte)' : '');
  }
}
