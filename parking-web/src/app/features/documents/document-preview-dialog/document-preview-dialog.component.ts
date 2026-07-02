import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

interface DocumentPreviewData {
  fileName: string;
  imageUrl: string;
}

@Component({
  selector: 'app-document-preview-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.fileName }}</h2>

    <mat-dialog-content class="preview-content">
      <img [src]="data.imageUrl" [alt]="data.fileName" />
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close type="button">Закрыть</button>
    </mat-dialog-actions>
  `,
  styles: `
    .preview-content {
      padding-top: 0;
    }

    img {
      display: block;
      max-width: min(720px, 80vw);
      max-height: 70vh;
      border-radius: 8px;
      object-fit: contain;
    }
  `,
})
export class DocumentPreviewDialogComponent {
  readonly data = inject<DocumentPreviewData>(MAT_DIALOG_DATA);
}
