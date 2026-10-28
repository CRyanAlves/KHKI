export function validatePhoto(file: File): string | null {
  return !['image/jpeg', 'image/png'].includes(file.type) || file.size === 0 || file.size > 5 * 1024 * 1024 ? 'Escolha uma foto JPG ou PNG com até 5 MB.' : null;
}
