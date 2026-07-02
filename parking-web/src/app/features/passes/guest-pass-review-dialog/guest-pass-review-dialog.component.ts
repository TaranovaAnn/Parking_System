import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

export interface GuestPassReviewDialogData {
  action: 'approve' | 'reject';
  plate: string;
}

@Component({
  selector: 'app-guest-pass-review-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>
      {{ data.action === 'approve' ? 'Одобрить заявку' : 'Отклонить заявку' }}
    </h2>

    <mat-dialog-content>
      <p class="description">
        {{ data.action === 'approve' ? 'Будет создан гостевой пропуск для номера' : 'Заявка будет отклонена для номера' }}
        <strong>{{ data.plate }}</strong>
      </p>

      <form [formGroup]="form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Комментарий</mat-label>
          <textarea matInput formControlName="reviewComment" rows="3"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="dialogRef.close()">Отмена</button>
      <button
        mat-flat-button
        [color]="data.action === 'approve' ? 'primary' : 'warn'"
        type="button"
        (click)="submit()"
      >
        {{ data.action === 'approve' ? 'Одобрить' : 'Отклонить' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .description {
      margin: 0 0 12px;
      color: #475569;
    }

    .full-width {
      width: 100%;
      min-width: 360px;
    }
  `,
})
export class GuestPassReviewDialogComponent {
  readonly dialogRef = inject(MatDialogRef<GuestPassReviewDialogComponent>);
  readonly data = inject<GuestPassReviewDialogData>(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    reviewComment: [''],
  });

  submit(): void {
    this.dialogRef.close({
      reviewComment: this.form.controls.reviewComment.value.trim() || undefined,
    });
  }
}
