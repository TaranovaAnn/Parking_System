import { Component, computed, effect, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { CreatePermanentPassRequest } from '../../../core/services/pass.service';
import { ReferenceDataService } from '../../../core/services/reference-data.service';
import { normalizePlate, PLATE_FORMAT_ERROR, PLATE_FORMAT_HINT, vehiclePlateValidator } from '../../../core/utils/plate.util';

function defaultValidToDate(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 2);
  return date.toISOString().slice(0, 10);
}

function dateToValidToIso(dateValue: string): string {
  const [year, month, day] = dateValue.split('-').map(Number);
  const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  return endOfDay.toISOString();
}

@Component({
  selector: 'app-permanent-pass-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>Постоянный пропуск</h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Сотрудник</mat-label>
          <mat-select formControlName="ownerUserId">
            @for (employee of employees(); track employee.id) {
              <mat-option [value]="employee.id">{{ employee.fullName }}</mat-option>
            }
          </mat-select>
          @if (form.controls.ownerUserId.touched && form.controls.ownerUserId.hasError('required')) {
            <mat-error>Выберите сотрудника</mat-error>
          }
          @if (employees().length === 0) {
            <mat-hint>Сотрудники не загружены</mat-hint>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Госномер</mat-label>
          <input matInput formControlName="vehiclePlate" [placeholder]="plateHint" />
          @if (form.controls.vehiclePlate.touched && form.controls.vehiclePlate.hasError('required')) {
            <mat-error>Укажите госномер</mat-error>
          }
          @if (form.controls.vehiclePlate.touched && form.controls.vehiclePlate.hasError('plateFormat')) {
            <mat-error>{{ plateFormatError }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Зона</mat-label>
          <mat-select formControlName="zoneId">
            @for (zone of zones(); track zone.id) {
              <mat-option [value]="zone.id">{{ zone.name }}</mat-option>
            }
          </mat-select>
          @if (form.controls.zoneId.touched && form.controls.zoneId.hasError('required')) {
            <mat-error>Выберите зону</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Действует до</mat-label>
          <input matInput type="date" formControlName="validToDate" />
          @if (form.controls.validToDate.touched && form.controls.validToDate.hasError('required')) {
            <mat-error>Укажите дату окончания</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Комментарий</mat-label>
          <textarea matInput formControlName="notes" rows="2"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="dialogRef.close()">Отмена</button>
      <button
        mat-flat-button
        color="primary"
        type="button"
        [disabled]="employees().length === 0 || zones().length === 0"
        (click)="submit()"
      >
        Создать
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 360px;
      padding-top: 8px;
    }

    .full-width {
      width: 100%;
    }
  `,
})
export class PermanentPassDialogComponent {
  private readonly fb = inject(FormBuilder);
  readonly dialogRef = inject(MatDialogRef<PermanentPassDialogComponent>);
  private readonly referenceData = inject(ReferenceDataService);

  readonly zones = this.referenceData.zones;
  readonly employees = computed(() =>
    this.referenceData.users().filter((user) => user.role === 'Employee'),
  );
  readonly plateHint = PLATE_FORMAT_HINT;
  readonly plateFormatError = PLATE_FORMAT_ERROR;

  readonly form = this.fb.nonNullable.group({
    ownerUserId: ['', Validators.required],
    vehiclePlate: ['', [Validators.required, vehiclePlateValidator()]],
    zoneId: ['', Validators.required],
    validToDate: [defaultValidToDate(), Validators.required],
    notes: [''],
  });

  constructor() {
    this.referenceData.loadUsers();
    this.referenceData.loadZones();

    effect(() => {
      const employees = this.employees();
      if (employees.length > 0 && !this.form.controls.ownerUserId.value) {
        this.form.patchValue({ ownerUserId: employees[0].id });
      }
    });

    effect(() => {
      const zones = this.zones();
      if (zones.length > 0 && !this.form.controls.zoneId.value) {
        this.form.patchValue({ zoneId: zones[0].id });
      }
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const result: CreatePermanentPassRequest = {
      ownerUserId: value.ownerUserId,
      vehiclePlate: normalizePlate(value.vehiclePlate),
      zoneId: value.zoneId,
      validTo: dateToValidToIso(value.validToDate),
      notes: value.notes.trim() || undefined,
    };

    this.dialogRef.close(result);
  }
}
