import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const PLATE_FORMAT_ERROR = 'Формат госномера: А111АА111';
export const PLATE_FORMAT_HINT = 'А111АА111';

const PLATE_REGEX = /^[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}\d{2,3}$/;

const LATIN_TO_CYRILLIC: Record<string, string> = {
  A: 'А',
  B: 'В',
  E: 'Е',
  K: 'К',
  M: 'М',
  H: 'Н',
  O: 'О',
  P: 'Р',
  C: 'С',
  T: 'Т',
  Y: 'У',
  X: 'Х',
};

export function normalizePlate(plate: string): string {
  const upper = plate.trim().toUpperCase().replace(/[\s-]/g, '');
  return [...upper].map((ch) => LATIN_TO_CYRILLIC[ch] ?? ch).join('');
}

export function isValidPlate(plate: string): boolean {
  return PLATE_REGEX.test(normalizePlate(plate));
}

export function vehiclePlateValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (!value) {
      return null;
    }

    return isValidPlate(String(value)) ? null : { plateFormat: true };
  };
}
