import { Component, effect, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { ReferenceDataService } from '../../../core/services/reference-data.service';
import {
  CreateGuestPassRequestSubmission,
} from '../../../core/services/pass.service';
import {
  normalizePlate,
  PLATE_FORMAT_ERROR,
  PLATE_FORMAT_HINT,
  vehiclePlateValidator,
} from '../../../core/utils/plate.util';

@Component({
  selector: 'app-guest-pass-request-dialog',
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
    <h2 mat-dialog-title>Гостевая заявка</h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>ФИО гостя</mat-label>
          <input matInput formControlName="guestFullName" />
          @if (form.controls.guestFullName.touched && form.controls.guestFullName.hasError('required')) {
            <mat-error>Укажите гостя</mat-error>
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
          <mat-label>Срок действия</mat-label>
          <mat-select formControlName="durationHours">
            <mat-option [value]="1">1 час</mat-option>
            <mat-option [value]="2">2 часа</mat-option>
            <mat-option [value]="4">4 часа</mat-option>
            <mat-option [value]="8">8 часов</mat-option>
          </mat-select>
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
        [disabled]="zones().length === 0"
        (click)="submit()"
      >
        Отправить
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
export class GuestPassRequestDialogComponent {
  private readonly fb = inject(FormBuilder);
  readonly dialogRef = inject(MatDialogRef<GuestPassRequestDialogComponent>);
  private readonly referenceData = inject(ReferenceDataService);

  readonly zones = this.referenceData.zones;
  readonly plateHint = PLATE_FORMAT_HINT;
  readonly plateFormatError = PLATE_FORMAT_ERROR;

  readonly form = this.fb.nonNullable.group({
    guestFullName: ['', Validators.required],
    vehiclePlate: ['', [Validators.required, vehiclePlateValidator()]],
    zoneId: ['', Validators.required],
    durationHours: [2, Validators.required],
    notes: [''],
  });

  constructor() {
    this.referenceData.loadZones();

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
    const result: CreateGuestPassRequestSubmission = {
      guestFullName: value.guestFullName.trim(),
      vehiclePlate: normalizePlate(value.vehiclePlate),
      zoneId: value.zoneId,
      durationHours: value.durationHours,
      notes: value.notes.trim() || undefined,
    };

    this.dialogRef.close(result);
  }
}
