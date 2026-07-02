import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { ParkingZone } from '../../../core/models/zone.model';
import { UpdateZoneRequest } from '../../../core/services/zone.service';

@Component({
  selector: 'app-zone-edit-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>Редактирование зоны</h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Название</mat-label>
          <input matInput formControlName="name" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Вместимость</mat-label>
          <input matInput type="number" formControlName="capacity" min="1" />
          @if (form.controls.capacity.touched && form.controls.capacity.hasError('min')) {
            <mat-error>Минимум 1 место</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Описание</mat-label>
          <textarea matInput formControlName="description" rows="2"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="dialogRef.close()">Отмена</button>
      <button mat-flat-button color="primary" type="button" (click)="submit()">Сохранить</button>
    </mat-dialog-actions>
  `,
  styles: `
    .form { display: flex; flex-direction: column; gap: 4px; min-width: 380px; padding-top: 8px; }
    .full-width { width: 100%; }
  `,
})
export class ZoneEditDialogComponent {
  readonly dialogRef = inject(MatDialogRef<ZoneEditDialogComponent>);
  private readonly fb = inject(FormBuilder);
  readonly data = inject<ParkingZone>(MAT_DIALOG_DATA);

  readonly form = this.fb.nonNullable.group({
    name: [this.data.name, Validators.required],
    capacity: [this.data.capacity, [Validators.required, Validators.min(1)]],
    description: [this.data.description ?? ''],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const result: UpdateZoneRequest = {
      name: value.name,
      capacity: value.capacity,
      description: value.description || undefined,
    };

    this.dialogRef.close(result);
  }
}
